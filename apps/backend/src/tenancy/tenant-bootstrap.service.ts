import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles';

@Injectable()
export class TenantBootstrapService {
  async ensureTenantTables(ds: DataSource, schema: string) {
    // Crea tabelle se mancanti (copiando struttura da public)
    // NB: meglio migrazioni, ma questo è pragmatico e robusto.
    await ds.query(`create schema if not exists ${schema}`);

    await ds.query(`create table if not exists ${schema}.users (like public.users including all)`);
    await ds.query(`create table if not exists ${schema}.invites (like public.invites including all)`);
    await ds.query(`create table if not exists ${schema}.audit_log (like public.audit_log including all)`);
  }

  async seedFirstAdmin(ds: DataSource, schema: string, email: string, password: string) {
    const existing = await ds.query(
      `select id from ${schema}.users where email = $1 limit 1`,
      [email],
    );
    if (existing.length > 0) return;

    const passwordHash = await bcrypt.hash(password, 10);
    const role: Role = 'owner' as any; // backend accetta owner in ROLE_LEVELS, anche se Role type non lo include
    // Se vuoi pulizia totale, sotto ti faccio aggiungere 'owner' al type Role.

    await ds.query(
      `
      insert into ${schema}.users (email, password_hash, role)
      values ($1, $2, $3)
      `,
      [email, passwordHash, role],
    );
  }
}
