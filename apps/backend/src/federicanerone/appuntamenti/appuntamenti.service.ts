import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type CreateAppuntamentoDto = {
  client_id: number | string; // Accettiamo stringhe dal frontend, poi le convertiamo
  treatment_id: number | string;
  starts_at: string; // ISO
  ends_at?: string | null;
  final_price_cents?: number | null;
  notes?: string | null;
  status?: string;
};

export type UpdateAppuntamentoDto = Partial<CreateAppuntamentoDto>;

// Tipo per i filtri
export type AppuntamentiFilter = {
  status?: string;
  from?: string; // yyyy-mm-dd
  to?: string;   // yyyy-mm-dd
};

@Injectable()
export class AppuntamentiService {
  
  // 1. Aggiornato per accettare 'filters' e costruire la query dinamica
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

    // Filtro Status
    if (filters.status && filters.status !== 'all') {
      sql += ` AND a.status = $${idx++}`;
      params.push(filters.status);
    }

    // Filtro Data Inizio (Da...)
    if (filters.from) {
      sql += ` AND a.starts_at >= $${idx++}`;
      // Aggiungiamo orario 00:00 per prendere tutto il giorno
      params.push(`${filters.from}T00:00:00.000Z`);
    }

    // Filtro Data Fine (A...)
    if (filters.to) {
      sql += ` AND a.starts_at <= $${idx++}`;
      // Aggiungiamo orario 23:59 per includere tutto il giorno
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
      `
      INSERT INTO federicanerone.appuntamenti
        (client_id, treatment_id, starts_at, ends_at, final_price_cents, notes, status, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, now(), now())
      RETURNING *
      `,
      [
        Number(dto.client_id), // Assicuriamo che sia un numero
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

    if (dto.client_id != null) { 
      fields.push(`client_id = $${idx++}`); 
      values.push(Number(dto.client_id)); 
    }
    if (dto.treatment_id != null) { 
      fields.push(`treatment_id = $${idx++}`); 
      values.push(Number(dto.treatment_id)); 
    }
    if (typeof dto.starts_at === 'string') { 
      fields.push(`starts_at = $${idx++}`); 
      values.push(dto.starts_at); 
    }
    if (typeof dto.ends_at === 'string' || dto.ends_at === null) { 
      fields.push(`ends_at = $${idx++}`); 
      values.push(dto.ends_at); 
    }
    if (typeof dto.final_price_cents === 'number' || dto.final_price_cents === null) { 
      fields.push(`final_price_cents = $${idx++}`); 
      values.push(dto.final_price_cents); 
    }
    if (typeof dto.notes === 'string' || dto.notes === null) { 
      fields.push(`notes = $${idx++}`); 
      values.push(dto.notes ? dto.notes.trim() : null); 
    }
    if (typeof dto.status === 'string') { 
      fields.push(`status = $${idx++}`); 
      values.push(dto.status.trim()); 
    }

    if (fields.length === 0) {
      // Nessun campo da aggiornare, restituiamo l'originale o errore
      // Per evitare errori 400 inutili se il frontend manda body vuoto, 
      // potremmo solo fare una select, ma qui lanciamo errore come prima.
      const err: any = new Error('no fields to update');
      err.statusCode = 400;
      throw err;
    }

    fields.push(`updated_at = now()`);

    values.push(id);
    const rows = await ds.query(
      `
      UPDATE federicanerone.appuntamenti
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
      `,
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