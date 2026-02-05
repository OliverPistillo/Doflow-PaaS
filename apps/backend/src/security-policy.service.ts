import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type MfaRolesPolicy = Record<string, boolean>;

@Injectable()
export class SecurityPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  async getMfaRolesPolicy(): Promise<MfaRolesPolicy> {
    const defaults: MfaRolesPolicy = {
      superadmin: true,
      owner: true,
      admin: true,
      manager: false,
      editor: false,
      viewer: false,
      user: false,
    };

    try {
      const rows = await this.dataSource.query(
        `select value from public.security_policy where key = 'mfa_roles' limit 1`,
      );

      const value = (rows?.[0]?.value ?? {}) as MfaRolesPolicy;

      // normalizza chiavi lowercase
      const normalized: MfaRolesPolicy = {};
      for (const [k, v] of Object.entries(value)) normalized[String(k).toLowerCase()] = Boolean(v);

      return { ...defaults, ...normalized };
    } catch {
      return defaults;
    }
  }
}
