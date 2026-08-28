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

  it('counts new notifications after the persisted seen watermark independently from unread', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('notification_digests')) return [];
      if (sql.includes('created_at > COALESCE')) return [{ count: 3 }];
      if (sql.includes("status = 'unread'")) return [{ count: 11 }];
      if (sql.includes('COUNT(*)')) return [{ count: 0 }];
      return [];
    });
    const { service } = makeService(query);
    const summary = await service.summary({ user: { sub: '22222222-2222-4222-8222-222222222222', role: 'manager', tenantId: 'doflow' } });
    expect(summary.newNotifications).toBe(3);
    expect(summary.unreadNotifications).toBe(11);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT preference.last_seen_at'),
      expect.arrayContaining(['22222222-2222-4222-8222-222222222222']),
    );
  });

  it('persists the maximum visible notification inside PostgreSQL without a Date roundtrip', async () => {
    const watermark = '2026-08-28T08:01:00.123456Z';
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('INSERT INTO "doflow".notification_preferences')) return [[{ last_seen_at: watermark }], 1];
      return [];
    });
    const { service } = makeService(query);
    jest.spyOn(service as any, 'publishState').mockResolvedValue(undefined);
    await expect(service.markSeen({ user: { sub: '22222222-2222-4222-8222-222222222222', role: 'manager', tenantId: 'doflow' } }))
      .resolves.toEqual({ lastSeenAt: watermark, newNotifications: 0 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/WITH visible_watermark[\s\S]*MAX\(created_at\)[\s\S]*INSERT INTO "doflow"\.notification_preferences[\s\S]*GREATEST/),
      [
        '22222222-2222-4222-8222-222222222222',
        '22222222-2222-4222-8222-222222222222',
        'manager',
        expect.arrayContaining(['invoice_overdue']),
      ],
    );
    expect(query.mock.calls[0][1]).not.toEqual(expect.arrayContaining([expect.any(Date)]));
  });
});
