import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { SaveDashboardDto } from './dto/save-dashboard.dto';

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getTenantSchema(): string {
    // Il middleware TenancyMiddleware popola questo campo
    return this.request.tenantId; 
  }

  private getUserId(): string {
    // Il middleware AuthMiddleware (Passport) popola questo
    return this.request.user.userId;
  }

  async getLayout() {
    const schema = this.getTenantSchema();
    const userId = this.getUserId();

    const widgets = await this.dataSource.query(
      `SELECT module_key as "moduleKey", position_x as x, position_y as y, width as w, height as h, id::text as i 
       FROM "${schema}".dashboard_widgets 
       WHERE user_id = $1`,
      [userId]
    );

    return widgets;
  }

  async saveLayout(dto: SaveDashboardDto) {
    const schema = this.getTenantSchema();
    const userId = this.getUserId();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Strategia "Tabula Rasa": Cancelliamo il vecchio layout per questo utente
      // (È più semplice che gestire update parziali sui posizionamenti)
      await queryRunner.query(
        `DELETE FROM "${schema}".dashboard_widgets WHERE user_id = $1`,
        [userId]
      );

      // 2. Inseriamo i nuovi widget
      for (const w of dto.widgets) {
        await queryRunner.query(
          `INSERT INTO "${schema}".dashboard_widgets 
           (user_id, module_key, position_x, position_y, width, height)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, w.moduleKey, w.x, w.y, w.w, w.h]
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