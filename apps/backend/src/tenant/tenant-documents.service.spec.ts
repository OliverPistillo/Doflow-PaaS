import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantDocumentsService } from './tenant-documents.service';

jest.mock('./tenant-documents-schema', () => ({
  ensureTenantDocumentsTables: jest.fn().mockResolvedValue(undefined),
  seedDoflowDocumentFolders: jest.fn().mockResolvedValue(undefined),
}));

const folderId = '11111111-1111-4111-8111-111111111111';
const user = { sub: '22222222-2222-4222-8222-222222222222', role: 'user', tenantId: 'doflow' };
const owner = { sub: '33333333-3333-4333-8333-333333333333', role: 'owner', tenantId: 'doflow' };

function makeService(authUser = user) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('document_folders') && /category/i.test(sql)) {
      throw new Error(`folder query must not reference category: ${sql}`);
    }
    if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }];
    if (sql.includes('FROM "doflow".document_folders')) {
      return [{
        id: folderId,
        name: 'Folder',
        slug: 'folder',
        visibility: 'internal',
        entity_type: null,
        entity_id: null,
        deleted_at: null,
      }];
    }
    return [];
  });
  const service = new TenantDocumentsService({ query } as any, {} as any, { user: authUser }) as any;
  return { service, query };
}

describe('TenantDocumentsService folders visibility', () => {
  it('list folders user non usa document_folders.category e filtra finance', async () => {
    const { service, query } = makeService(user);

    const result = await service.listFolders({});

    expect(result.items).toHaveLength(1);
    const folderSql = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('document_folders')).join('\n');
    expect(folderSql).not.toMatch(/category/i);
    expect(folderSql).toContain("document_folders.visibility <> 'finance'");
    expect(folderSql).toContain('document_folders.entity_type');
  });

  it('get folder user non usa document_folders.category', async () => {
    const { service, query } = makeService(user);

    await expect(service.getFolder(folderId)).resolves.toMatchObject({ id: folderId });

    const folderSql = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('document_folders')).join('\n');
    expect(folderSql).not.toMatch(/category/i);
  });

  it('owner vede cartelle finance senza filtro folder finance', async () => {
    const { service, query } = makeService(owner);

    await service.listFolders({});

    const folderSql = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('document_folders')).join('\n');
    expect(folderSql).not.toMatch(/visibility <> 'finance'/);
    expect(folderSql).not.toMatch(/category/i);
  });

  it('document visibility mantiene category per i documenti', () => {
    const { service } = makeService(user);

    const sql = service.documentVisibilitySql({ id: user.sub, role: 'user' }, 'd');

    expect(sql).toContain('d.category');
    expect(sql).toContain('d.entity_type');
    expect(sql).toContain("d.visibility <> 'finance'");
  });

  it('richiede target Doflow completo in upload e rifiuta record inesistenti', async () => {
    const { service } = makeService(owner);
    const file = { originalname: 'file.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') } as any;
    await expect(service.uploadDocument(file, { entity_type: 'company' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.documentsForEntity('company', folderId, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filtra i file del record con parametri search, categoria e stato', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM "doflow".companies')) return [{ id: folderId }];
      if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }];
      if (sql.includes('FROM "doflow".documents d')) return [{ id: folderId, title: 'Logo', status: 'active', category: 'project_asset', visibility: 'internal' }];
      return [];
    });
    const service = new TenantDocumentsService({ query } as any, {} as any, { user: owner }) as any;
    const result = await service.documentsForEntity('company', folderId, { search: 'logo', category: 'project_asset', status: 'active' });
    expect(result.items).toHaveLength(1);
    const documentCall = query.mock.calls.find(([sql]) => String(sql).includes('SELECT d.*, f.name'));
    expect(documentCall?.[0]).toContain('document_links dl');
    expect(documentCall?.[0]).toContain('lower(coalesce(d.title');
    expect(documentCall?.[0]).toContain('d.category = $');
    expect(documentCall?.[1]).toEqual(expect.arrayContaining(['company', folderId, 'active', '%logo%', 'project_asset']));
  });
});
