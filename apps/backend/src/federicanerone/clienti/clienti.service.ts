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
  async list(ds: DataSource) {
    return ds.query(
      `select id, full_name, phone, email, notes, created_at, updated_at
       from federicanerone.clienti
       order by created_at desc`,
    );
  }

  async create(ds: DataSource, dto: CreateClienteDto) {
    const fullName = (dto.full_name ?? '').trim();
    if (!fullName) {
      const err: any = new Error('full_name required');
      err.statusCode = 400;
      throw err;
    }

    const rows = await ds.query(
      `insert into federicanerone.clienti (full_name, phone, email, notes, created_at, updated_at)
       values ($1, $2, $3, $4, now(), now())
       returning id, full_name, phone, email, notes, created_at, updated_at`,
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
      `update federicanerone.clienti
       set ${fields.join(', ')}
       where id = $${idx}
       returning id, full_name, phone, email, notes, created_at, updated_at`,
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
      `delete from federicanerone.clienti where id = $1 returning id`,
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
