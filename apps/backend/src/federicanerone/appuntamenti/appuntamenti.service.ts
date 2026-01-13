import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type CreateAppuntamentoDto = {
  client_id: number;
  treatment_id: number;
  starts_at: string; // ISO
  ends_at?: string | null;
  final_price_cents?: number | null;
  notes?: string | null;
  status?: string;
};

export type UpdateAppuntamentoDto = Partial<CreateAppuntamentoDto>;

@Injectable()
export class AppuntamentiService {
  async list(ds: DataSource) {
    return ds.query(
      `
      select
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
      from federicanerone.appuntamenti a
      join federicanerone.clienti c on c.id = a.client_id
      join federicanerone.trattamenti t on t.id = a.treatment_id
      order by a.starts_at desc
      `,
    );
  }

  async create(ds: DataSource, dto: CreateAppuntamentoDto) {
    if (!dto.client_id || !dto.treatment_id || !dto.starts_at) {
      const err: any = new Error('client_id, treatment_id, starts_at required');
      err.statusCode = 400;
      throw err;
    }

    const rows = await ds.query(
      `
      insert into federicanerone.appuntamenti
        (client_id, treatment_id, starts_at, ends_at, final_price_cents, notes, status, created_at, updated_at)
      values
        ($1, $2, $3, $4, $5, $6, $7, now(), now())
      returning *
      `,
      [
        dto.client_id,
        dto.treatment_id,
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

    if (typeof dto.client_id === 'number') { fields.push(`client_id = $${idx++}`); values.push(dto.client_id); }
    if (typeof dto.treatment_id === 'number') { fields.push(`treatment_id = $${idx++}`); values.push(dto.treatment_id); }
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
      `
      update federicanerone.appuntamenti
      set ${fields.join(', ')}
      where id = $${idx}
      returning *
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
      `delete from federicanerone.appuntamenti where id = $1 returning id`,
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
