import { expect, it, vi } from 'vitest';

import { PageInvitationAcceptHandler } from '@colanode/client/handlers/mutations/accounts/page-invitation-accept';
import { PageShareMutationHandler } from '@colanode/client/handlers/mutations/nodes/page-share';
import { SharedPagesListQueryHandler } from '@colanode/client/handlers/queries/nodes/shared-pages-list';
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
  'opens the shared page after inviting a guest (workspace already stored: %s)',
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
    const page = {
      name: 'Shared original',
      content: null,
      revision: null,
      canEdit: false,
      pages: [],
      files: [],
    };
    const accepted = { workspaceId: workspace.workspace_id, pageId: 'page-id' };
    let service: AccountService;
    let initialized = false;
    const app = {
      client: {
        extend: () => ({
          post: (url: string) => ({
            json: async () =>
              url.endsWith('/page-invitations/accept')
                ? accepted
                : {
                    account,
                    workspaces: [
                      {
                        id: workspace.workspace_id,
                        name: workspace.name,
                        status: workspace.status,
                        user: { id: workspace.user_id, role: workspace.role },
                      },
                    ],
                  },
          }),
          get: (url: string) => ({
            json: async () => {
              expect(initialized).toBe(true);
              return url.endsWith('/mine')
                ? { pages: [{ id: accepted.pageId, name: page.name }] }
                : page;
            },
          }),
        }),
      },
      getAccount: () => service,
      getWorkspace: (id: string) =>
        initialized && id === workspace.user_id
          ? {
              workspaceId: workspace.workspace_id,
              status: workspace.status,
              account: service,
            }
          : undefined,
      database: {
        transaction: () => ({
          execute: (run: (tx: typeof trx) => unknown) => run(trx),
        }),
      },
      initWorkspace: vi.fn(async () => {
        initialized = true;
        order.push('initialize');
      }),
    } as unknown as AppService;
    const publish = vi
      .spyOn(eventBus, 'publish')
      .mockImplementation((event) => {
        if (event.type === eventType) order.push(eventType);
      });

    try {
      service = new AccountService(
        mapAccount(account),
        {
          domain: account.server,
          httpBaseUrl: `https://${account.server}`,
          isAvailable: true,
        } as ServerService,
        app
      );
      await expect(
        new PageInvitationAcceptHandler(app).handleMutation({
          type: 'page.invitation.accept',
          accountId: account.id,
          token: 'synthetic-token',
          server: account.server,
        })
      ).resolves.toEqual(accepted);
      await expect(
        new PageShareMutationHandler(app).handleMutation({
          type: 'page.share',
          action: 'read',
          userId: workspace.user_id,
          pageId: accepted.pageId,
        })
      ).resolves.toEqual({ action: 'read', page });
      await expect(
        new SharedPagesListQueryHandler(app).handleQuery({
          type: 'shared.pages.list',
          userId: workspace.user_id,
        })
      ).resolves.toEqual([{ id: accepted.pageId, name: page.name }]);

      expect(app.initWorkspace).toHaveBeenCalledWith(workspace);
      expect(order).toEqual(['initialize', eventType]);
    } finally {
      publish.mockRestore();
    }
  }
);
