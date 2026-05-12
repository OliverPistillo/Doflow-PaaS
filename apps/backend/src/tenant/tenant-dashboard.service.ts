import { BadRequestException, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { SaveDashboardDto } from './dto/save-dashboard.dto';
import { safeSchema } from '../common/schema.utils';
import {
  DASHBOARD_WIDGET_MIN_PLAN,
  normalizePlan,
  planIncludes,
  PlanTier,
} from '../feature-access/dashboard-widget-access';

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getTenantSchema(): string {
    const user = this.request.user || this.request.authUser;

    // Il JWT è più affidabile dell'header tenant: evita salvataggi su public
    // quando l'app è aperta da app.doflow.it/localhost.
    const tenantRef =
      user?.tenantId ||
      user?.tenant_id ||
      this.request.tenantId ||
      'public';

    return safeSchema(tenantRef, 'TenantDashboardService.getTenantSchema');
  }

  private getUserId(): string {
    const user = this.request.user || this.request.authUser;
    const userId = user?.sub || user?.id || user?.userId;
    if (!userId) throw new ForbiddenException('Utente non valido');
    return String(userId);
  }

  private async getTenantPlan(schema: string): Promise<PlanTier> {
    if (!schema || schema === 'public') return 'ENTERPRISE';

    const rows = await this.dataSource.query(
      `SELECT plan_tier AS "planTier"
       FROM public.tenants
       WHERE schema_name = $1 OR slug = $1 OR id::text = $1
       LIMIT 1`,
      [schema],
    );

    return normalizePlan(rows[0]?.planTier);
  }

  private assertWidgetsAllowed(plan: PlanTier, widgets: Array<{ i?: string; moduleKey?: string }>) {
    const violations: Array<{ widget: string; requiredPlan: PlanTier }> = [];
    const unknown: string[] = [];

    for (const widget of widgets || []) {
      const key = String(widget.moduleKey || widget.i || '').trim();
      if (!key) {
        unknown.push('(empty)');
        continue;
      }

      const required = DASHBOARD_WIDGET_MIN_PLAN[key];
      if (!required) {
        unknown.push(key);
        continue;
      }

      if (!planIncludes(plan, required)) {
        violations.push({ widget: key, requiredPlan: required });
      }
    }

    if (unknown.length > 0) {
      throw new BadRequestException({
        error: 'UNKNOWN_DASHBOARD_WIDGET',
        widgets: unknown,
        message: 'Widget dashboard non riconosciuto.',
      });
    }

    if (violations.length > 0) {
      throw new ForbiddenException({
        error: 'DASHBOARD_WIDGET_PLAN_REQUIRED',
        currentPlan: plan,
        violations,
        message: 'Il layout contiene widget non inclusi nel piano attuale.',
      });
    }
  }

  async getLayout() {
    const schema = this.getTenantSchema();
    const userId = this.getUserId();
    const plan = await this.getTenantPlan(schema);

    const widgets = await this.dataSource.query(
      `SELECT
         module_key AS "moduleKey",
         module_key AS i,
         x,
         y,
         w,
         h
       FROM "${schema}".dashboard_widgets
       WHERE user_id = $1
       ORDER BY y ASC, x ASC`,
      [userId],
    );

    // Non mostrare vecchi widget diventati illegali dopo downgrade piano.
    return widgets.filter((w: any) => {
      const required = DASHBOARD_WIDGET_MIN_PLAN[w.moduleKey || w.i];
      return required ? planIncludes(plan, required) : false;
    });
  }

  async saveLayout(dto: SaveDashboardDto) {
    const schema = this.getTenantSchema();
    const userId = this.getUserId();
    const widgets = dto.widgets || [];
    const plan = await this.getTenantPlan(schema);

    this.assertWidgetsAllowed(plan, widgets);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `DELETE FROM "${schema}".dashboard_widgets WHERE user_id = $1`,
        [userId],
      );

      if (widgets.length > 0) {
        const placeholders = widgets
          .map((_, i) => {
            const base = i * 6;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
          })
          .join(', ');

        const params = widgets.flatMap((w) => [
          userId,
          w.moduleKey || w.i,
          w.x,
          w.y,
          w.w,
          w.h,
        ]);

        await queryRunner.query(
          `INSERT INTO "${schema}".dashboard_widgets
             (user_id, module_key, x, y, w, h)
           VALUES ${placeholders}`,
          params,
        );
      }

      await queryRunner.commitTransaction();
      return { success: true };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
