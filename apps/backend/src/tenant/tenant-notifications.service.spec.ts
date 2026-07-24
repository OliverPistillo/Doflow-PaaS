import { TenantNotificationsService } from './tenant-notifications.service';

describe('TenantNotificationsService', () => {
  function makeService(queryImpl?: jest.Mock) {
    const query = queryImpl || jest.fn().mockResolvedValue([]);
    const service = new TenantNotificationsService({ query } as any);
    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    return { service, query };
  }

  it('deduplica le notifiche con fingerprint stabile', async () => {
    const { service, query } = makeService(jest.fn().mockResolvedValue([]));

    const result = await service.createNotification('doflow', {
      recipient_role: 'manager',
      title: 'Task scaduto',
      type: 'task_overdue',
      fingerprint: 'task_overdue:task-1:2026-07-09',
    });

    expect(result.created).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (fingerprint)'),
      expect.arrayContaining(['task_overdue:task-1:2026-07-09']),
    );
  });

  it('genera notifiche task_overdue per assegnatario o manager fallback', async () => {
    const { service, query } = makeService();
    jest.spyOn(service as any, 'tableExists').mockResolvedValue(true);
    jest.spyOn(service, 'createNotification').mockResolvedValue({ created: true, notification: { id: 'n1' } });
    query.mockResolvedValueOnce([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Preparare checklist',
        due_at: '2026-07-08T08:00:00.000Z',
        assignee_id: '22222222-2222-4222-8222-222222222222',
        project_id: '33333333-3333-4333-8333-333333333333',
        project_manager_id: null,
        project_name: 'Sito doflow',
      },
    ]);

    const created = await (service as any).scanTaskOverdue('doflow');

    expect(created).toBe(1);
    expect(service.createNotification).toHaveBeenCalledWith('doflow', expect.objectContaining({
      recipient_user_id: '22222222-2222-4222-8222-222222222222',
      type: 'task_overdue',
      entity_type: 'task',
      link_url: '/projects/33333333-3333-4333-8333-333333333333',
    }));
  });

  it('non conta notifiche finance nella summary manager', async () => {
    const { service, query } = makeService();
    jest.spyOn(service as any, 'tableExists').mockResolvedValue(true);
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('notification_digests')) return [];
      if (sql.includes('COUNT(*)')) {
        expect(sql).toContain('type <> ALL');
        expect(params).toEqual(expect.arrayContaining([expect.arrayContaining(['invoice_overdue'])]));
        return [{ count: 0 }];
      }
      return [];
    });

    const summary = await service.summary({
      user: {
        sub: '22222222-2222-4222-8222-222222222222',
        role: 'manager',
        tenantId: 'doflow',
      },
    });

    expect(summary.financeNotifications).toBe(0);
  });
});
