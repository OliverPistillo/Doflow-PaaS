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
  
  // Lista arricchita con logica VIP Dinamica
  async list(ds: DataSource, search?: string) {
    // 1. Recuperiamo la configurazione VIP
    const settingsRes = await ds.query(
      `SELECT value FROM federicanerone.settings WHERE key = 'vip_config'`
    );
    const vipConfig = settingsRes[0]?.value || { thresholdEur: 500, period: 'annual' };
    
    const thresholdCents = Number(vipConfig.thresholdEur) * 100;
    
    // Mappiamo il periodo in intervallo SQL Postgres
    let sqlInterval = '1 year'; // Default
    switch (vipConfig.period) {
      case 'monthly': sqlInterval = '1 month'; break;
      case 'quarterly': sqlInterval = '3 months'; break;
      case 'semiannual': sqlInterval = '6 months'; break;
      case 'annual': sqlInterval = '1 year'; break;
    }

    // 2. Query Principale
    let sql = `
      SELECT 
        c.id,
        c.full_name,
        c.phone,
        c.email,
        c.notes,
        c.created_at,
        c.updated_at,
        
        -- Spesa Totale (Storico completo)
        COALESCE(SUM(CASE WHEN a.status = 'closed_won' THEN a.final_price_cents ELSE 0 END), 0) as total_spent_cents,
        
        -- Ultima Visita
        MAX(a.starts_at) as last_visit_at,
        
        -- Conteggio Appuntamenti
        COUNT(a.id) as total_appointments,

        -- CALCOLO VIP DINAMICO (Spesa nel periodo specifico >= Soglia)
        (
          COALESCE(SUM(
            CASE 
              WHEN a.status = 'closed_won' 
                   AND a.starts_at >= NOW() - INTERVAL '${sqlInterval}' 
              THEN a.final_price_cents 
              ELSE 0 
            END
          ), 0) >= ${thresholdCents}
        ) as is_vip

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

  // ... (Il resto del file rimane uguale: getStats, create, update, remove) ...
  // Riporto getStats per completezza, non cambia nulla qui
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

    const formattedTop = topClients.map((c: any) => ({
      name: c.name,
      value: Number(c.value) / 100
    }));

    return { topClients: formattedTop };
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
       RETURNING *`,
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

    if (fields.length === 0) throw new Error('no fields to update');

    fields.push(`updated_at = now()`);
    values.push(id);
    
    const rows = await ds.query(
      `UPDATE federicanerone.clienti SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (!rows[0]) throw new Error('cliente not found');
    return rows[0];
  }

  async remove(ds: DataSource, id: string) {
    const rows = await ds.query(
      `DELETE FROM federicanerone.clienti WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new Error('cliente not found');
    return true;
  }
}