import { buildCollaborationLegacyReport, parseCollaborationLegacyOptions } from './map-doflow-collaboration-legacy';

describe('Doflow collaboration legacy mapper', () => {
  it('is dry-run by default and tenant scoped', () => {
    expect(parseCollaborationLegacyOptions([])).toEqual({ tenant: 'doflow', apply: false });
    expect(() => parseCollaborationLegacyOptions(['--tenant=other'])).toThrow(/restricted/);
  });

  it('reports ambiguous rows without inventing comments or notifications', () => {
    expect(buildCollaborationLegacyReport(10, 7, 3, 2)).toEqual({
      tenant: 'doflow', sourceProjectComments: 10, eligible: 7, ambiguous: 3, alreadyMapped: 2,
    });
  });
});
