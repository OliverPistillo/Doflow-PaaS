import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from './tenant-credentials.types';
import { credentialUuidOrNull } from './tenant-credentials-uuid';

const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);

type PermissionAction = 'read' | 'create' | 'edit' | 'reveal' | 'manage_permissions' | 'audit';

@Injectable()
export class TenantCredentialsPermissionsService {
  constructor(private readonly dataSource: DataSource) {}

  isAdmin(user: AuthUser): boolean {
    return ADMIN_ROLES.has(String(user.role || '').toLowerCase());
  }

  async canUseModule(schema: string, user: AuthUser, action: PermissionAction): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    const userId = this.uuidOrNull(user.id);
    if (!userId) return false;

    const column = action === 'create'
      ? 'can_create'
      : action === 'edit'
        ? 'can_update'
        : action === 'manage_permissions'
          ? 'can_manage'
          : 'can_view';

    const moduleKeys = [`credentials.${action}`, 'credentials'];
    const rows = await this.dataSource.query(
      `SELECT 1
       FROM "${schema}".team_members tm
       JOIN "${schema}".team_module_permissions tmp
         ON tmp.team_member_id = tm.id
        AND tmp.deleted_at IS NULL
       WHERE tm.deleted_at IS NULL
         AND tm.user_id = $1
         AND tmp.module_key = ANY($2::text[])
         AND (tmp.${column} = true OR tmp.can_manage = true)
       LIMIT 1`,
      [userId, moduleKeys],
    ).catch(() => []);

    return rows.length > 0;
  }

  async getItemAcl(schema: string, itemId: string, user: AuthUser): Promise<Record<string, boolean> | null> {
    if (this.isAdmin(user)) {
      return {
        can_view_metadata: true,
        can_reveal_secret: true,
        can_edit: true,
        can_manage_permissions: true,
      };
    }
    const userId = this.uuidOrNull(user.id);
    if (!userId) return null;
    const rows = await this.dataSource.query(
      `SELECT can_view_metadata, can_reveal_secret, can_edit, can_manage_permissions
       FROM "${schema}".credential_permissions
       WHERE credential_item_id = $1
         AND user_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [itemId, userId],
    );
    return rows[0] || null;
  }

  async canReadItem(schema: string, itemId: string, user: AuthUser): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    const [moduleOk, acl] = await Promise.all([
      this.canUseModule(schema, user, 'read'),
      this.getItemAcl(schema, itemId, user),
    ]);
    return moduleOk && Boolean(acl?.can_view_metadata);
  }

  async assertCanCreate(schema: string, user: AuthUser) {
    if (await this.canUseModule(schema, user, 'create')) return;
    throw new ForbiddenException('Non hai permessi per questa operazione.');
  }

  async assertCanReadItem(schema: string, itemId: string, user: AuthUser) {
    if (await this.canReadItem(schema, itemId, user)) return;
    throw new ForbiddenException('Non hai permessi per questa operazione.');
  }

  async assertCanEditItem(schema: string, itemId: string, user: AuthUser) {
    if (this.isAdmin(user)) return;
    const [moduleOk, acl] = await Promise.all([
      this.canUseModule(schema, user, 'edit'),
      this.getItemAcl(schema, itemId, user),
    ]);
    if (moduleOk && acl?.can_edit) return;
    throw new ForbiddenException('Non hai permessi per questa operazione.');
  }

  async assertCanRevealItem(schema: string, itemId: string, user: AuthUser) {
    if (this.isAdmin(user)) return;
    const [moduleOk, acl] = await Promise.all([
      this.canUseModule(schema, user, 'reveal'),
      this.getItemAcl(schema, itemId, user),
    ]);
    if (moduleOk && acl?.can_reveal_secret) return;
    throw new ForbiddenException('Non hai permessi per questa operazione.');
  }

  async assertCanManagePermissions(schema: string, itemId: string, user: AuthUser) {
    if (this.isAdmin(user)) return;
    const [moduleOk, acl] = await Promise.all([
      this.canUseModule(schema, user, 'manage_permissions'),
      this.getItemAcl(schema, itemId, user),
    ]);
    if (moduleOk && acl?.can_manage_permissions) return;
    throw new ForbiddenException('Non hai permessi per questa operazione.');
  }

  private uuidOrNull(value: unknown): string | null {
    return credentialUuidOrNull(value);
  }
}
