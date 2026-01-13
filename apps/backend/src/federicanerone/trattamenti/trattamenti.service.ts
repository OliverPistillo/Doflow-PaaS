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
  async list(ds: DataSource) {
    return ds.query(
      `select id, name, duration_minutes, price_cents, category, badge_color, is_active, created_at, updated_at
       from federicanerone.trattamenti
       order by created_at desc`,
    );
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
      `insert into federicanerone.trattamenti
       (name, duration_minutes, price_cents, category, badge_color, is_active, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, now(), now())
       returning id, name, duration_minutes, price_cents, category, badge_color, is_active, created_at, updated_at`,
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
      `update federicanerone.trattamenti
       set ${fields.join(', ')}
       where id = $${idx}
       returning id, name, duration_minutes, price_cents, category, badge_color, is_active, created_at, updated_at`,
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
    const rows = await ds.query(
      `delete from federicanerone.trattamenti where id = $1 returning id`,
      [id],
    );
    if (!rows[0]) {
      const err: any = new Error('trattamento not found');
      err.statusCode = 404;
      throw err;
    }
    return true;
  }
}
