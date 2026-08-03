import { UnprocessableEntityException } from '@nestjs/common';
import { TenantSiteProposalsController } from './tenant-site-proposals.controller';

describe('TenantSiteProposalsController', () => {
  it('forwards bounded activity query values to the protected service', () => {
    const service = { listActivity: jest.fn() } as any;
    const controller = new TenantSiteProposalsController(service);
    controller.listActivity('proposal-id', '50', '10');
    expect(service.listActivity).toHaveBeenCalledWith('proposal-id', { limit: '50', offset: '10' });
  });

  it('returns a completed single generation normally', async () => {
    const completed = { id: 'generation-id', status: 'completed' };
    const service = { generateProposal: jest.fn().mockResolvedValue(completed) } as any;
    const controller = new TenantSiteProposalsController(service);

    await expect(controller.generate('proposal-id')).resolves.toBe(completed);
  });

  it('returns a sanitized 422 when a single generation fails', async () => {
    const service = { generateProposal: jest.fn().mockResolvedValue({ status: 'failed', error_message: 'Render non riuscito' }) } as any;
    const controller = new TenantSiteProposalsController(service);

    await expect(controller.generate('proposal-id')).rejects.toBeInstanceOf(UnprocessableEntityException);
    try {
      await controller.generate('proposal-id');
    } catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({ message: 'Render non riuscito' });
    }
  });

  it('uses the generic error for failed generations without an error message', async () => {
    const service = { generateProposal: jest.fn().mockResolvedValue({ status: 'failed' }) } as any;
    const controller = new TenantSiteProposalsController(service);

    await expect(controller.generate('proposal-id')).rejects.toBeInstanceOf(UnprocessableEntityException);
    try {
      await controller.generate('proposal-id');
    } catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({ message: 'Generazione non riuscita.' });
    }
  });

  it('does not expose internal failure details from a single generation', async () => {
    const service = { generateProposal: jest.fn().mockResolvedValue({ status: 'failed', error_message: 'postgres stack trace S3 secret' }) } as any;
    const controller = new TenantSiteProposalsController(service);

    await expect(controller.generate('proposal-id')).rejects.toBeInstanceOf(UnprocessableEntityException);
    try {
      await controller.generate('proposal-id');
    } catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({ message: 'Generazione non riuscita.' });
    }
  });

  it('leaves batch generation responses unchanged', async () => {
    const batch = { total: 2, success: 1, failed: 1, status: 'partial', results: [] };
    const service = { generateImport: jest.fn().mockResolvedValue(batch) } as any;
    const controller = new TenantSiteProposalsController(service);

    await expect(controller.generateImport('import-id')).resolves.toBe(batch);
  });
});
