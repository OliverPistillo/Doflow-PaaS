import { TenantSiteProposalsController } from './tenant-site-proposals.controller';

describe('TenantSiteProposalsController', () => {
  it('forwards bounded activity query values to the protected service', () => {
    const service = { listActivity: jest.fn() } as any;
    const controller = new TenantSiteProposalsController(service);
    controller.listActivity('proposal-id', '50', '10');
    expect(service.listActivity).toHaveBeenCalledWith('proposal-id', { limit: '50', offset: '10' });
  });
});
