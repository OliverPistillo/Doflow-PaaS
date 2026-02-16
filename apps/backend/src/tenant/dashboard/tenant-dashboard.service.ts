import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantDashboardService {
  private readonly logger = new Logger(TenantDashboardService.name);

  constructor(private readonly dataSource: DataSource) {}

  private safeSchema(schema: string) {
    // Se lo schema è nullo o undefined, forziamo public, ma logghiamo l'anomalia
    if (!schema) {
        this.logger.warn("⚠️ Schema non definito, fallback su 'public'");
        return 'public';
    }
    return schema.replace(/[^a-z0-9_ -]/g, '');
  }

  async getUserLayout(schema: string, userId: string) {
    const safe = this.safeSchema(schema);
    // this.logger.log(`🔍 Reading layout for User [${userId}] in Schema [${safe}]`);
    
    // Controlliamo se la tabella esiste prima di query (evita crash 500)
    const tableExists = await this.dataSource.query(
      `SELECT to_regclass('${safe}.dashboard_widgets') as exists`
    );
    
    if (!tableExists[0].exists) {
        this.logger.warn(`⚠️ Table ${safe}.dashboard_widgets does not exist yet.`);
        return [];
    }

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
    this.logger.log(`💾 SAVING layout: Schema=[${safe}], User=[${userId}], Widgets=[${widgets.length}]`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Assicuriamoci che la tabella esista (Autofix se manca)
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${safe}"."dashboard_widgets" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "user_id" uuid NOT NULL,
            "module_key" text NOT NULL,
            "x" integer DEFAULT 0,
            "y" integer DEFAULT 0,
            "w" integer DEFAULT 1,
            "h" integer DEFAULT 1,
            "settings" jsonb DEFAULT '{}'::jsonb,
            "created_at" timestamp DEFAULT now()
        )
      `);

      // 2. Cancelliamo il layout precedente per questo utente
      await queryRunner.query(
        `DELETE FROM "${safe}"."dashboard_widgets" WHERE user_id = $1`,
        [userId]
      );

      // 3. Inseriamo i nuovi widget
      for (const w of widgets) {
        // Fallback per i nomi delle proprietà (per robustezza)
        const i = w.i || w.moduleKey;
        const x = w.x ?? 0;
        const y = w.y ?? 0;
        const width = w.w ?? 1;
        const height = w.h ?? 1;

        await queryRunner.query(
          `INSERT INTO "${safe}"."dashboard_widgets" (user_id, module_key, x, y, w, h)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, i, x, y, width, height]
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Layout saved successfully for ${safe}.${userId}`);
      return { success: true };

    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error saving layout: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}