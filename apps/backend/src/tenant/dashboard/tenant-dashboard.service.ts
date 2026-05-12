import { Injectable, Logger, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { safeSchema } from '../../common/schema.utils';
import { DASHBOARD_WIDGET_MIN_PLAN, normalizePlan, planIncludes, PlanTier } from '../../feature-access/dashboard-widget-access';

@Injectable()
export class TenantDashboardService {
  private readonly logger = new Logger(TenantDashboardService.name);

  constructor(private readonly dataSource: DataSource) {}

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

  private assertWidgetsAllowed(plan: PlanTier, widgets: WidgetInput[]) {
    const violations: Array<{ widget: string; requiredPlan: PlanTier }> = [];
    const unknown: string[] = [];

    for (const widget of widgets || []) {
      const key = String(widget.moduleKey || widget.i || '').trim();
      const required = DASHBOARD_WIDGET_MIN_PLAN[key];
      if (!key || !required) {
        unknown.push(key || '(empty)');
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

  // ─────────────────────────────────────────────────────────────
  //  GET LAYOUT
  // ─────────────────────────────────────────────────────────────

  async getUserLayout(schema: string, userId: string): Promise<WidgetRow[]> {
    // FIX 🔴: safeSchema unificato — lancia eccezione su input non valido
    const safe = safeSchema(schema, 'TenantDashboardService.getUserLayout');

    // FIX 🔴: to_regclass con doppi apici per evitare SQL injection
    const tableCheck = await this.dataSource.query(
      `SELECT to_regclass('"${safe}"."dashboard_widgets"') AS exists`,
    );

    if (!tableCheck[0]?.exists) {
      this.logger.warn(
        `Table "${safe}".dashboard_widgets does not exist. ` +
        `Tenant bootstrap may be incomplete.`,
      );
      return [];
    }

    const rows = await this.dataSource.query(
      `SELECT
         module_key   AS i,
         module_key   AS "moduleKey",
         x, y, w, h
       FROM "${safe}"."dashboard_widgets"
       WHERE user_id = $1
       ORDER BY y ASC, x ASC`,
      [userId],
    );

    const plan = await this.getTenantPlan(safe);
    return (rows as WidgetRow[]).filter((w) => {
      const required = DASHBOARD_WIDGET_MIN_PLAN[w.moduleKey || w.i];
      return required ? planIncludes(plan, required) : false;
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  SAVE LAYOUT
  // ─────────────────────────────────────────────────────────────

  async saveUserLayout(
    schema: string,
    userId: string,
    widgets: WidgetInput[],
  ): Promise<{ success: true }> {
    const safe = safeSchema(schema, 'TenantDashboardService.saveUserLayout');

    this.logger.log(
      `Saving layout: schema="${safe}" user="${userId}" widgets=${widgets.length}`,
    );

    // FIX 🟠: CREATE TABLE rimosso — la tabella deve esistere dal bootstrap.
    // Se non esiste, è un errore di provisioning che va surfacciato, non nascosto.
    const tableCheck = await this.dataSource.query(
      `SELECT to_regclass('"${safe}"."dashboard_widgets"') AS exists`,
    );
    if (!tableCheck[0]?.exists) {
      throw new InternalServerErrorException(
        `Table "${safe}".dashboard_widgets not found. ` +
        `Run tenant bootstrap to provision the schema correctly.`,
      );
    }

    const plan = await this.getTenantPlan(safe);
    this.assertWidgetsAllowed(plan, widgets);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Pulizia layout precedente
      await queryRunner.query(
        `DELETE FROM "${safe}"."dashboard_widgets" WHERE user_id = $1`,
        [userId],
      );

      // FIX 🟠: Batch INSERT — un singolo roundtrip invece di N query in loop
      if (widgets.length > 0) {
        const valuePlaceholders = widgets
          .map((_, i) => {
            const base = i * 6;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
          })
          .join(', ');

        const params = widgets.flatMap((w) => [
          userId,
          w.i ?? w.moduleKey,
          w.x ?? 0,
          w.y ?? 0,
          w.w ?? 1,
          w.h ?? 1,
        ]);

        await queryRunner.query(
          `INSERT INTO "${safe}"."dashboard_widgets"
             (user_id, module_key, x, y, w, h)
           VALUES ${valuePlaceholders}`,
          params,
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Layout saved: schema="${safe}" user="${userId}"`);
      return { success: true };

    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Layout save failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

// ─── Tipi locali ────────────────────────────────────────────────

export interface WidgetRow {
  i: string;
  moduleKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetInput {
  i?: string;
  moduleKey?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}
