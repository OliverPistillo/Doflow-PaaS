import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { COLSOVA_TEMPLATE } from './tenant-site-proposals.constants';

describe('ensureDoflowSiteProposalTables', () => {
  it('is doflow-only and upserts the manifest derived from the canonical template', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await ensureDoflowSiteProposalTables({ query } as any, 'doflow');
    const seedCall = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO "doflow".site_proposal_templates'));
    expect(seedCall).toBeDefined();
    expect(seedCall[0]).toContain('ON CONFLICT (slug, version) DO UPDATE');
    expect(seedCall[0]).not.toContain('DO NOTHING');
    const manifest = JSON.parse(seedCall[1][5]);
    expect(manifest).toMatchObject({
      name: 'Tema Colsova',
      slug: 'colsova',
      version: '1.0.0',
      sourceSha256: COLSOVA_TEMPLATE.sourceSha256,
      fixedCounts: { treatmentCards: 3, productPoints: 3, reviews: 6, faqs: 6 },
    });
    expect(manifest.imageSlots).toHaveLength(10);
    expect(manifest.routes).toContain('bookingPage');
    expect(Object.keys(manifest.textLimits).length).toBeGreaterThan(0);
  });

  it('rejects every schema other than doflow before issuing SQL', async () => {
    const query = jest.fn();
    await expect(ensureDoflowSiteProposalTables({ query } as any, 'federicanerone')).rejects.toThrow('only for doflow');
    expect(query).not.toHaveBeenCalled();
  });
});
