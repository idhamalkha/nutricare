import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query } }));

import { createNotificationsForRoles, listNotifications, markNotificationRead, markAllNotificationsRead, clearNotifications } from '../../src/modules/notifications.js';

it('routes role-targeted notifications to the relevant page', async () => {
  vi.clearAllMocks();
  query.mockResolvedValueOnce({ rowCount: 2, rows: [] });
  await createNotificationsForRoles(['logistik', 'waiter'], {
    title: 'Makanan siap', body: 'Persiapan selesai',
    roleLinks: { logistik: '/pages/logistik.html#dapur', waiter: '/pages/waiter.html#distribusi' },
  });
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('$6::jsonb ->> p.role');
  expect(params[5]).toBe(JSON.stringify({ logistik: '/pages/logistik.html#dapur', waiter: '/pages/waiter.html#distribusi' }));
});

it('stores the detail payload so the inbox can show a popup', async () => {
  vi.clearAllMocks();
  query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
  const detail = {
    kind: 'pasien' as const,
    ringkas: 'Siti terdaftar di Melati 3.',
    fields: [{ label: 'Ruangan', value: 'Melati 3' }],
  };
  await createNotificationsForRoles(['perawat'], { title: 'Pasien baru', body: 'Siti', detail });
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('$7::jsonb');
  expect(JSON.parse(params[6] as string)).toEqual(detail);
});

it('sends notifications without detail as null', async () => {
  vi.clearAllMocks();
  query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
  await createNotificationsForRoles(['perawat'], { title: 'X', body: 'Y' });
  expect(query.mock.calls[0][1][6]).toBeNull();
});

it('rejects a detail payload that is too large', async () => {
  vi.clearAllMocks();
  const huge = { kind: 'umum' as const, ringkas: 'x'.repeat(9000) };
  await expect(createNotificationsForRoles(['perawat'], { title: 'X', body: 'Y', detail: huge }))
    .rejects.toThrow('terlalu besar');
  expect(query).not.toHaveBeenCalled();
});

it('rejects external notification links', async () => {
  vi.clearAllMocks();
  await expect(createNotificationsForRoles(['logistik'], { title: 'X', body: 'Y', link: 'https://example.com' })).rejects.toThrow('path lokal');
  expect(query).not.toHaveBeenCalled();
});



it('still delivers a notification when the detail column is not migrated yet', async () => {
  vi.clearAllMocks();
  const error: any = new Error('column "detail" of relation "notifications" does not exist');
  error.code = '42703';
  query.mockRejectedValueOnce(error).mockResolvedValueOnce({ rowCount: 1, rows: [] });
  const count = await createNotificationsForRoles(['perawat'], {
    title: 'X', body: 'Y', detail: { kind: 'umum', ringkas: 'z' },
  });
  expect(count).toBe(1);
  expect(query.mock.calls[1][0]).not.toContain('detail');
});

describe('notification inbox', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lists only the authenticated user’s notifications, newest first', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'n1', type: 'info', title: 'T', body: 'B', link: null, read_at: null, created_at: '2026-11-01T00:00:00Z' }] });
    const result = await listNotifications('user-1');
    expect(query.mock.calls[0][1]).toEqual(['user-1', 50]);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({ id: 'n1', read: false });
  });

  it('reads the inbox without detail when the column is not migrated yet', async () => {
    const error: any = new Error('column "detail" of relation "notifications" does not exist');
    error.code = '42703';
    query.mockRejectedValueOnce(error).mockResolvedValueOnce({ rows: [{ id: 'n1', type: 'info', title: 'T', body: 'B', link: null, read_at: null, created_at: '2026-11-01T00:00:00Z' }] });
    const result = await listNotifications('user-1');
    expect(result.notifications[0]).toMatchObject({ id: 'n1', detail: null });
    expect(query.mock.calls[1][0]).not.toContain('detail');
  });

  it('marks a notification read only for its owner', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'n1', read_at: 'now' }] });
    expect(await markNotificationRead('user-1', 'n1')).toBe(true);
    expect(query.mock.calls[0][1]).toEqual(['user-1', 'n1']);
  });

  it('marks all unread notifications read for the current user only', async () => {
    query.mockResolvedValueOnce({ rowCount: 3, rows: [] });
    expect(await markAllNotificationsRead('user-1')).toBe(3);
    expect(query.mock.calls[0][1]).toEqual(['user-1']);
  });

  it('clears only the current user’s notifications', async () => {
    query.mockResolvedValueOnce({ rowCount: 4, rows: [] });
    expect(await clearNotifications('user-1')).toBe(4);
    expect(query.mock.calls[0][1]).toEqual(['user-1']);
  });
});
