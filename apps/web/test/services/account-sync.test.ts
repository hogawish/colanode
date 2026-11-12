import { expect, it, vi } from 'vitest';

import { eventBus } from '@colanode/client/lib/event-bus';
import { mapAccount } from '@colanode/client/lib/mappers';
import { AccountService } from '@colanode/client/services/accounts/account-service';
import type { AppService } from '@colanode/client/services/app-service';
import type { ServerService } from '@colanode/client/services/server-service';

vi.mock('@colanode/client/services/accounts/account-socket', () => ({
  AccountSocket: class {
    checkConnection() {}
  },
}));

it.each([
  [false, 'workspace.created'],
  [true, 'workspace.updated'],
] as const)(
  'initializes a synced guest workspace before notifying the UI (already stored: %s)',
  async (stored, eventType) => {
    const account = {
      id: 'guest-account',
      name: 'Guest',
      email: 'guest@example.test',
      avatar: null,
      device_id: 'device',
      token: 'test',
      server: 'server.example.test',
      created_at: '2026-01-01T00:00:00.000Z',
      synced_at: null,
      updated_at: null,
    };
    const workspace = {
      account_id: account.id,
      workspace_id: 'shared-workspace',
      user_id: 'guest-user',
      name: 'Shared workspace',
      role: 'guest',
      status: 1,
    };
    const rowQuery = (row: unknown) => ({
      returningAll: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(row),
    });
    const trx = {
      updateTable: (table: string) =>
        rowQuery(table === 'accounts' ? account : workspace),
      insertInto: () => rowQuery(workspace),
      selectFrom: () => ({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(stored ? [workspace] : []),
      }),
    };
    const order: string[] = [];
    const app = {
      client: {
        extend: () => ({
          post: () => ({
            json: async () => ({
              account,
              workspaces: [
                {
                  id: workspace.workspace_id,
                  name: workspace.name,
                  status: workspace.status,
                  user: { id: workspace.user_id, role: workspace.role },
                },
              ],
            }),
          }),
        }),
      },
      database: {
        transaction: () => ({
          execute: (run: (tx: typeof trx) => unknown) => run(trx),
        }),
      },
      initWorkspace: vi.fn(async () => {
        order.push('initialize');
      }),
    } as unknown as AppService;
    const publish = vi
      .spyOn(eventBus, 'publish')
      .mockImplementation((event) => {
        if (event.type === eventType) order.push(eventType);
      });

    try {
      const service = new AccountService(
        mapAccount(account),
        {
          domain: account.server,
          httpBaseUrl: `https://${account.server}`,
          isAvailable: true,
        } as ServerService,
        app
      );
      await service.sync();

      expect(app.initWorkspace).toHaveBeenCalledWith(workspace);
      expect(order).toEqual(['initialize', eventType]);
    } finally {
      publish.mockRestore();
    }
  }
);
