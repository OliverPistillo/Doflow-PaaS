import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type CreateTrattamentoDto = {
  name: string;
  duration_minutes?: number;
  price_cents?: number;
  category?: string | null;
  badge_color?: string | null;
  is_active?: boolean;
};

export type UpdateTrattamentoDto = Partial<CreateTrattamentoDto>;

@Injectable()
export class TrattamentiService {
  
  // Lista Catalogo (con statistiche aggregate)
  async list(ds: DataSource, search?: string) {
    let sql = `
      SELECT 
        t.id, t.name, t.duration_minutes, t.price_cents, 
        t.category, t.badge_color, t.is_active, 
        t.created_at, t.updated_at,
        COALESCE(SUM(CASE WHEN a.status = 'closed_won' THEN a.final_price_cents ELSE 0 END), 0) as total_revenue_cents,
        COUNT(CASE WHEN a.status = 'closed_won' THEN 1 END) as executed_count
      FROM federicanerone.trattamenti t
      LEFT JOIN federicanerone.appuntamenti a ON a.treatment_id = t.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (search) {
      sql += ` AND t.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    sql += ` GROUP BY t.id ORDER BY t.name ASC`;

    return ds.query(sql, params);
  }

  // --- NUOVO: Storico Esecuzioni ---
  async getHistory(ds: DataSource, from?: string, to?: string, q?: string) {
    let sql = `
      SELECT 
        a.id, 
        a.starts_at, 
        a.final_price_cents,
        c.full_name as client_name,
        t.name as treatment_name
      FROM federicanerone.appuntamenti a
      JOIN federicanerone.clienti c ON a.client_id = c.id
      JOIN federicanerone.trattamenti t ON a.treatment_id = t.id
      WHERE a.status = 'closed_won' -- Solo quelli eseguiti
    `;

    const params: any[] = [];
    let pIdx = 1;

    if (from) {
      sql += ` AND a.starts_at >= $${pIdx++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND a.starts_at <= $${pIdx++}`;
      params.push(to);
    }
    if (q) {
      sql += ` AND (c.full_name ILIKE $${pIdx} OR t.name ILIKE $${pIdx})`;
      params.push(`%${q}%`);
      pIdx++;
    }

    sql += ` ORDER BY a.starts_at DESC LIMIT 200`; // Limitiamo per sicurezza

    return ds.query(sql, params);
  }

  // Statistiche (Invariato)
  async getStats(ds: DataSource) {
    const topRevenue = await ds.query(`
      SELECT 
        t.name, 
        COALESCE(SUM(a.final_price_cents), 0) as value
      FROM federicanerone.trattamenti t
      JOIN federicanerone.appuntamenti a ON a.treatment_id = t.id
      WHERE a.status = 'closed_won'
      GROUP BY t.id, t.name
      ORDER BY value DESC
      LIMIT 5
    `);

    return {
      topRevenue: topRevenue.map((r: any) => ({ name: r.name, value: Number(r.value) / 100 })),
    };
  }

  async create(ds: DataSource, dto: CreateTrattamentoDto) {
    const name = (dto.name ?? '').trim();
    if (!name) {
      const err: any = new Error('name required');
      err.statusCode = 400;
      throw err;
    }

    const duration = Number.isFinite(dto.duration_minutes) ? Number(dto.duration_minutes) : 60;
    const price = Number.isFinite(dto.price_cents) ? Number(dto.price_cents) : 0;

    const rows = await ds.query(
      `INSERT INTO federicanerone.trattamenti
       (name, duration_minutes, price_cents, category, badge_color, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [
        name,
        duration,
        price,
        (dto.category ?? '').toString().trim() || null,
        (dto.badge_color ?? '').toString().trim() || null,
        dto.is_active ?? true,
      ],
    );
    return rows[0];
  }

  async update(ds: DataSource, id: string, dto: UpdateTrattamentoDto) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof dto.name === 'string') { fields.push(`name = $${idx++}`); values.push(dto.name.trim()); }
    if (typeof dto.duration_minutes === 'number') { fields.push(`duration_minutes = $${idx++}`); values.push(dto.duration_minutes); }
    if (typeof dto.price_cents === 'number') { fields.push(`price_cents = $${idx++}`); values.push(dto.price_cents); }
    if (typeof dto.category === 'string' || dto.category === null) { fields.push(`category = $${idx++}`); values.push(dto.category ? dto.category.trim() : null); }
    if (typeof dto.badge_color === 'string' || dto.badge_color === null) { fields.push(`badge_color = $${idx++}`); values.push(dto.badge_color ? dto.badge_color.trim() : null); }
    if (typeof dto.is_active === 'boolean') { fields.push(`is_active = $${idx++}`); values.push(dto.is_active); }

    if (fields.length === 0) {
      const err: any = new Error('no fields to update');
      err.statusCode = 400;
      throw err;
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    const rows = await ds.query(
      `UPDATE federicanerone.trattamenti SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (!rows[0]) {
      const err: any = new Error('trattamento not found');
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  async remove(ds: DataSource, id: string) {
    const rows = await ds.query(`DELETE FROM federicanerone.trattamenti WHERE id = $1 RETURNING id`, [id]);
    if (!rows[0]) {
      const err: any = new Error('trattamento not found');
      err.statusCode = 404;
      throw err;
    }
    return true;
  }
}