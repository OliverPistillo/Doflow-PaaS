import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { ForbiddenException } from '@nestjs/common';
import { FileStorageService } from '../file-storage.service';

const proposalId = '550e8400-e29b-41d4-a716-446655440000';
const prefix = `doflow/site-proposals/${proposalId}/`;

function makeStorage(send: jest.Mock) {
  const storage = new FileStorageService();
  (storage as any).s3 = { send };
  return storage;
}

describe('FileStorageService proposal generated prefix deletion', () => {
  it('lists an empty valid prefix and returns zero without deleting', async () => {
    const send = jest.fn().mockResolvedValue({ Contents: [], IsTruncated: false });
    await expect(makeStorage(send).deleteGeneratedPrefix(prefix)).resolves.toBe(0);
    expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
    expect(send.mock.calls.some(([command]) => command instanceof DeleteObjectsCommand)).toBe(false);
  });

  it('deletes listed objects and returns the count', async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Contents: [{ Key: `${prefix}a.html` }, { Key: `${prefix}b.zip` }], IsTruncated: false })
      .mockResolvedValueOnce({});
    await expect(makeStorage(send).deleteGeneratedPrefix(prefix)).resolves.toBe(2);
    const command = send.mock.calls[1][0] as DeleteObjectsCommand;
    expect(command.input.Delete?.Objects).toHaveLength(2);
  });

  it('uses continuation tokens and deletes every page', async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Contents: [{ Key: `${prefix}a` }], IsTruncated: true, NextContinuationToken: 'next' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Contents: [{ Key: `${prefix}b` }], IsTruncated: false })
      .mockResolvedValueOnce({});
    await expect(makeStorage(send).deleteGeneratedPrefix(prefix)).resolves.toBe(2);
    const secondList = send.mock.calls[2][0] as ListObjectsV2Command;
    expect(secondList.input.ContinuationToken).toBe('next');
  });

  it('chunks deletion requests at no more than 1000 objects', async () => {
    const contents = Array.from({ length: 1001 }, (_, index) => ({ Key: `${prefix}${index}` }));
    const send = jest.fn().mockResolvedValueOnce({ Contents: contents, IsTruncated: false }).mockResolvedValue({});
    await expect(makeStorage(send).deleteGeneratedPrefix(prefix)).resolves.toBe(1001);
    const deletes = send.mock.calls.slice(1).map(([command]) => (command as DeleteObjectsCommand).input.Delete?.Objects?.length);
    expect(deletes).toEqual([1000, 1]);
  });

  it('rejects delete responses containing errors', async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Contents: [{ Key: `${prefix}a` }], IsTruncated: false })
      .mockResolvedValueOnce({ Errors: [{ Key: `${prefix}a`, Code: 'AccessDenied' }] });
    await expect(makeStorage(send).deleteGeneratedPrefix(prefix)).rejects.toThrow('deletion failed');
  });

  it.each([
    '',
    `other/site-proposals/${proposalId}/`,
    `doflow/other/${proposalId}/`,
    'doflow/site-proposals/not-a-uuid/',
    `doflow/site-proposals/../${proposalId}/`,
    `doflow\\site-proposals\\${proposalId}\\`,
    `doflow/site-proposals/${proposalId}/\0`,
  ])('rejects unsafe prefix %p', async (unsafePrefix) => {
    const send = jest.fn();
    await expect(makeStorage(send).deleteGeneratedPrefix(unsafePrefix)).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });
});
