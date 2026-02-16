import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private safeSchema(schema: string) {
    return schema.replace(/[^a-z0-9_ -]/g, '');
  }

  async getUserLayout(schema: string, userId: string) {
    const safe = this.safeSchema(schema);
    
    // Leggiamo i widget salvati per questo utente
    const rows = await this.dataSource.query(
      `SELECT module_key as i, module_key as "moduleKey", x, y, w, h 
       FROM "${safe}"."dashboard_widgets" 
       WHERE user_id = $1`,
      [userId]
    );
    
    return rows;
  }

  async saveUserLayout(schema: string, userId: string, widgets: any[]) {
    const safe = this.safeSchema(schema);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Cancelliamo il layout precedente per questo utente (approccio semplice e pulito)
      await queryRunner.query(
        `DELETE FROM "${safe}"."dashboard_widgets" WHERE user_id = $1`,
        [userId]
      );

      // 2. Inseriamo i nuovi widget
      for (const w of widgets) {
        await queryRunner.query(
          `INSERT INTO "${safe}"."dashboard_widgets" (user_id, module_key, x, y, w, h)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, w.moduleKey || w.i, w.x, w.y, w.w, w.h]
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