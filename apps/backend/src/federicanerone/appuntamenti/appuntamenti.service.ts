import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type CreateAppuntamentoDto = {
  client_id: number | string;
  treatment_id: number | string;
  starts_at: string;
  ends_at?: string | null;
  final_price_cents?: number | null;
  notes?: string | null;
  status?: string;
};

export type UpdateAppuntamentoDto = Partial<CreateAppuntamentoDto>;

export type AppuntamentiFilter = {
  status?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class AppuntamentiService {
  
// --- METODO STATISTICHE AGGIORNATO ---
  async getStats(ds: DataSource, year: number) {
    // 1. KPI Appuntamenti (Counts per status)
    const kpiRaw = await ds.query(`
      SELECT 
        status, 
        COUNT(*) as count,
        SUM(COALESCE(final_price_cents, 0)) as revenue
      FROM federicanerone.appuntamenti
      WHERE EXTRACT(YEAR FROM starts_at) = $1
      GROUP BY status
    `, [year]);

    // 2. KPI Clienti (Nuovi Lead reali = Clienti creati quest'anno)
    const clientsRaw = await ds.query(`
      SELECT COUNT(*) as count 
      FROM federicanerone.clienti
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year]);
    
    const newClientsCount = Number(clientsRaw[0]?.count || 0);

    // Mappatura
    const kpiMap: Record<string, number> = {};
    let totalRevenue = 0;

    kpiRaw.forEach((row: any) => {
      kpiMap[row.status] = Number(row.count);
      if (row.status === 'closed_won') {
        totalRevenue += Number(row.revenue);
      }
    });

    // 3. Fatturato Mensile
    const monthlyRaw = await ds.query(`
      SELECT 
        EXTRACT(MONTH FROM starts_at) as month, 
        SUM(final_price_cents) as total
      FROM federicanerone.appuntamenti
      WHERE 
        EXTRACT(YEAR FROM starts_at) = $1 
        AND status = 'closed_won' 
      GROUP BY month
      ORDER BY month ASC
    `, [year]);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const found = monthlyRaw.find((r: any) => Number(r.month) === i + 1);
      return {
        month: i + 1,
        value: found ? Number(found.total) / 100 : 0
      };
    });

    // 4. Trattamenti
    const treatmentsRaw = await ds.query(`
      SELECT 
        t.name, 
        COUNT(a.id) as count
      FROM federicanerone.appuntamenti a
      JOIN federicanerone.trattamenti t ON t.id = a.treatment_id
      WHERE EXTRACT(YEAR FROM a.starts_at) = $1
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 5
    `, [year]);

    const treatmentsData = treatmentsRaw.map((row: any) => ({
      name: row.name,
      value: Number(row.count)
    }));

    return {
      kpi: {
        new_lead: newClientsCount, // ORA CONTA I CLIENTI VERI
        no_answer: kpiMap['no_answer'] || 0,
        booked: kpiMap['booked'] || 0,
        waiting: kpiMap['waiting'] || 0,
        closed_won: kpiMap['closed_won'] || 0,
        closed_lost: kpiMap['closed_lost'] || 0, // Si aggiornerà col tasto "Annulla"
        fatturato_eur: totalRevenue / 100,
      },
      monthly: monthlyData,
      treatments: treatmentsData,
    };
  }

  // --- METODI CRUD ESISTENTI (INVARIATI) ---

  async list(ds: DataSource, filters: AppuntamentiFilter = {}) {
    let sql = `
      SELECT
        a.id,
        a.client_id,
        c.full_name as client_name,
        a.treatment_id,
        t.name as treatment_name,
        a.starts_at,
        a.ends_at,
        a.final_price_cents,
        a.notes,
        a.status,
        a.google_event_id,
        a.created_at,
        a.updated_at
      FROM federicanerone.appuntamenti a
      JOIN federicanerone.clienti c ON c.id = a.client_id
      JOIN federicanerone.trattamenti t ON t.id = a.treatment_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let idx = 1;

    if (filters.status && filters.status !== 'all') {
      sql += ` AND a.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.from) {
      sql += ` AND a.starts_at >= $${idx++}`;
      params.push(`${filters.from}T00:00:00.000Z`);
    }
    if (filters.to) {
      sql += ` AND a.starts_at <= $${idx++}`;
      params.push(`${filters.to}T23:59:59.999Z`);
    }

    sql += ` ORDER BY a.starts_at DESC`;
    return ds.query(sql, params);
  }

  async create(ds: DataSource, dto: CreateAppuntamentoDto) {
    if (!dto.client_id || !dto.treatment_id || !dto.starts_at) {
      const err: any = new Error('client_id, treatment_id, starts_at required');
      err.statusCode = 400;
      throw err;
    }

    const rows = await ds.query(
      `INSERT INTO federicanerone.appuntamenti (client_id, treatment_id, starts_at, ends_at, final_price_cents, notes, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING *`,
      [
        Number(dto.client_id),
        Number(dto.treatment_id),
        dto.starts_at,
        dto.ends_at ?? null,
        typeof dto.final_price_cents === 'number' ? dto.final_price_cents : null,
        (dto.notes ?? '').toString().trim() || null,
        (dto.status ?? 'booked').toString().trim(),
      ],
    );
    return rows[0];
  }

  async update(ds: DataSource, id: string, dto: UpdateAppuntamentoDto) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.client_id != null) { fields.push(`client_id = $${idx++}`); values.push(Number(dto.client_id)); }
    if (dto.treatment_id != null) { fields.push(`treatment_id = $${idx++}`); values.push(Number(dto.treatment_id)); }
    if (typeof dto.starts_at === 'string') { fields.push(`starts_at = $${idx++}`); values.push(dto.starts_at); }
    if (typeof dto.ends_at === 'string' || dto.ends_at === null) { fields.push(`ends_at = $${idx++}`); values.push(dto.ends_at); }
    if (typeof dto.final_price_cents === 'number' || dto.final_price_cents === null) { fields.push(`final_price_cents = $${idx++}`); values.push(dto.final_price_cents); }
    if (typeof dto.notes === 'string' || dto.notes === null) { fields.push(`notes = $${idx++}`); values.push(dto.notes ? dto.notes.trim() : null); }
    if (typeof dto.status === 'string') { fields.push(`status = $${idx++}`); values.push(dto.status.trim()); }

    if (fields.length === 0) {
      const err: any = new Error('no fields to update');
      err.statusCode = 400;
      throw err;
    }

    fields.push(`updated_at = now()`);
    values.push(id);
    
    const rows = await ds.query(
      `UPDATE federicanerone.appuntamenti SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (!rows[0]) {
      const err: any = new Error('appuntamento not found');
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  async remove(ds: DataSource, id: string) {
    const rows = await ds.query(
      `DELETE FROM federicanerone.appuntamenti WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) {
      const err: any = new Error('appuntamento not found');
      err.statusCode = 404;
      throw err;
    }
    return true;
  }
}