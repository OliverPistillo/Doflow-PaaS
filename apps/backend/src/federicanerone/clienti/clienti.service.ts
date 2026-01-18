import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type CreateClienteDto = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type UpdateClienteDto = Partial<CreateClienteDto>;

@Injectable()
export class ClientiService {
  
  // Lista arricchita con Statistiche (Spesa Totale + Ultima Visita)
  async list(ds: DataSource, search?: string) {
    let sql = `
      SELECT 
        c.id,
        c.full_name,
        c.phone,
        c.email,
        c.notes,
        c.created_at,
        c.updated_at,
        -- Calcolo Spesa Totale (solo appuntamenti 'closed_won')
        COALESCE(SUM(CASE WHEN a.status = 'closed_won' THEN a.final_price_cents ELSE 0 END), 0) as total_spent_cents,
        -- Calcolo Ultima Visita
        MAX(a.starts_at) as last_visit_at,
        -- Conteggio Appuntamenti
        COUNT(a.id) as total_appointments
      FROM federicanerone.clienti c
      LEFT JOIN federicanerone.appuntamenti a ON a.client_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (search) {
      sql += ` AND (c.full_name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1)`;
      params.push(`%${search}%`);
    }

    sql += ` GROUP BY c.id ORDER BY c.full_name ASC`;

    return ds.query(sql, params);
  }

  // Statistiche specifiche per i grafici (Top 10 Clienti)
  async getStats(ds: DataSource) {
    const topClients = await ds.query(`
      SELECT 
        c.full_name as name,
        COALESCE(SUM(a.final_price_cents), 0) as value
      FROM federicanerone.clienti c
      JOIN federicanerone.appuntamenti a ON a.client_id = c.id
      WHERE a.status = 'closed_won'
      GROUP BY c.id, c.full_name
      ORDER BY value DESC
      LIMIT 10
    `);

    // Converti cents in euro per il grafico
    const formattedTop = topClients.map((c: any) => ({
      name: c.name,
      value: Number(c.value) / 100
    }));

    return {
      topClients: formattedTop
    };
  }

  async create(ds: DataSource, dto: CreateClienteDto) {
    const fullName = (dto.full_name ?? '').trim();
    if (!fullName) {
      const err: any = new Error('full_name required');
      err.statusCode = 400;
      throw err;
    }

    const rows = await ds.query(
      `INSERT INTO federicanerone.clienti (full_name, phone, email, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, full_name, phone, email, notes, created_at, updated_at`,
      [
        fullName,
        (dto.phone ?? '').toString().trim() || null,
        (dto.email ?? '').toString().trim().toLowerCase() || null,
        (dto.notes ?? '').toString().trim() || null,
      ],
    );
    return rows[0];
  }

  async update(ds: DataSource, id: string, dto: UpdateClienteDto) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof dto.full_name === 'string') {
      fields.push(`full_name = $${idx++}`);
      values.push(dto.full_name.trim());
    }
    if (typeof dto.phone === 'string' || dto.phone === null) {
      fields.push(`phone = $${idx++}`);
      values.push(dto.phone ? dto.phone.trim() : null);
    }
    if (typeof dto.email === 'string' || dto.email === null) {
      fields.push(`email = $${idx++}`);
      values.push(dto.email ? dto.email.trim().toLowerCase() : null);
    }
    if (typeof dto.notes === 'string' || dto.notes === null) {
      fields.push(`notes = $${idx++}`);
      values.push(dto.notes ? dto.notes.trim() : null);
    }

    if (fields.length === 0) {
      const err: any = new Error('no fields to update');
      err.statusCode = 400;
      throw err;
    }

    fields.push(`updated_at = now()`);
    values.push(id);
    
    const rows = await ds.query(
      `UPDATE federicanerone.clienti SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (!rows[0]) {
      const err: any = new Error('cliente not found');
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  async remove(ds: DataSource, id: string) {
    const rows = await ds.query(
      `DELETE FROM federicanerone.clienti WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) {
      const err: any = new Error('cliente not found');
      err.statusCode = 404;
      throw err;
    }
    return true;
  }
}