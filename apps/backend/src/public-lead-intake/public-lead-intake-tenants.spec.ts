import { isPublicLeadIntakeTenantEnabled, publicLeadIntakeTenants } from './public-lead-intake-tenants';

describe('public lead intake tenant configuration', () => {
  const originalTenants = process.env.PUBLIC_LEAD_INTAKE_TENANTS;

  afterEach(() => {
    if (originalTenants === undefined) delete process.env.PUBLIC_LEAD_INTAKE_TENANTS;
    else process.env.PUBLIC_LEAD_INTAKE_TENANTS = originalTenants;
  });

  it('abilita solo doflow per default', () => {
    delete process.env.PUBLIC_LEAD_INTAKE_TENANTS;
    expect(isPublicLeadIntakeTenantEnabled('doflow')).toBe(true);
    expect(isPublicLeadIntakeTenantEnabled('other-tenant')).toBe(false);
  });

  it('normalizza la stessa lista configurata usata dal public endpoint', () => {
    expect(Array.from(publicLeadIntakeTenants(' Doflow, altro-tenant, doflow '))).toEqual(['doflow', 'altro-tenant']);
  });
});
