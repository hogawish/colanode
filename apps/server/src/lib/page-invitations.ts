import { createHash, randomBytes } from 'node:crypto';

import type { Transaction } from 'kysely';

import {
  AccountStatus,
  extractNodeRole,
  generateId,
  hasWorkspaceRole,
  IdType,
  UserStatus,
  WorkspaceStatus,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import type { DatabaseSchema } from '@colanode/server/data/schema';
import { eventBus } from '@colanode/server/lib/event-bus';
import { fetchNodeTree, mapNode } from '@colanode/server/lib/nodes';
import type { PageShareRole } from '@colanode/server/lib/page-shares';

const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const getMembership = (
  trx: Transaction<DatabaseSchema>,
  workspaceId: string,
  accountId: string
) =>
  trx
    .selectFrom('users')
    .select(['id', 'status', 'role'])
    .where('workspace_id', '=', workspaceId)
    .where('account_id', '=', accountId)
    .executeTakeFirst();

export const setPageGrant = (
  trx: Transaction<DatabaseSchema>,
  pageId: string,
  memberId: string,
  role: PageShareRole
) =>
  trx
    .insertInto('page_shares')
    .values({ page_id: pageId, viewer_id: memberId, role })
    .onConflict((conflict) =>
      conflict.columns(['page_id', 'viewer_id']).doUpdateSet({ role })
    )
    .execute();

export const inviteToPage = async (input: {
  pageId: string;
  workspaceId: string;
  inviterId: string;
  canInviteNewMember: boolean;
  email: string;
  role: PageShareRole;
}) =>
  database.transaction().execute(async (trx) => {
    const email = input.email.trim().toLowerCase();
    const member = await trx
      .selectFrom('users')
      .innerJoin('accounts', 'accounts.id', 'users.account_id')
      .select([
        'users.id',
        'users.status',
        'users.role',
        'accounts.status as account_status',
      ])
      .where('users.workspace_id', '=', input.workspaceId)
      .where('accounts.email', '=', email)
      .executeTakeFirst();
    if (
      member &&
      (member.status !== UserStatus.Active || member.role === 'none')
    )
      return null;
    if (member?.account_status === AccountStatus.Active) {
      await trx
        .deleteFrom('page_invitations')
        .where('page_id', '=', input.pageId)
        .where('email', '=', email)
        .execute();
      await setPageGrant(trx, input.pageId, member.id, input.role);
      return { type: 'shared' as const };
    }
    if (!input.canInviteNewMember) return null;

    const token = randomBytes(32).toString('base64url');
    const invitation = {
      role: input.role,
      token_hash: tokenHash(token),
      inviter_id: input.inviterId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    await trx
      .insertInto('page_invitations')
      .values({ page_id: input.pageId, email, ...invitation })
      .onConflict((conflict) =>
        conflict.columns(['page_id', 'email']).doUpdateSet(invitation)
      )
      .execute();
    return { type: 'invited' as const, token };
  });

export const acceptPageInvitation = async (
  accountId: string,
  token: string
) => {
  const result = await database.transaction().execute(async (trx) => {
    const account = await trx
      .selectFrom('accounts')
      .select(['id', 'email', 'name', 'avatar'])
      .where('id', '=', accountId)
      .where('status', '=', AccountStatus.Active)
      .executeTakeFirst();
    if (!account) return null;
    const invitation = await trx
      .selectFrom('page_invitations')
      .selectAll()
      .where('token_hash', '=', tokenHash(token))
      .where('email', '=', account.email.toLowerCase())
      .where('expires_at', '>', new Date())
      .forUpdate()
      .executeTakeFirst();
    if (!invitation) return null;

    const tree = await fetchNodeTree(invitation.page_id);
    const page = tree.at(-1);
    if (page?.type !== 'page' || page.id !== invitation.page_id) return null;
    const workspaceId = page.workspace_id;
    const workspace = await trx
      .selectFrom('workspaces')
      .select('status')
      .where('id', '=', workspaceId)
      .executeTakeFirst();
    const inviter = await trx
      .selectFrom('users')
      .select(['id', 'status', 'role', 'account_id'])
      .where('id', '=', invitation.inviter_id)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();
    if (
      workspace?.status !== WorkspaceStatus.Active ||
      inviter?.status !== UserStatus.Active ||
      !hasWorkspaceRole(inviter.role, 'admin') ||
      extractNodeRole(tree.map(mapNode), inviter.id) !== 'admin'
    )
      return null;

    let member = await getMembership(trx, workspaceId, accountId);
    let joined = false;
    if (!member) {
      member = await trx
        .insertInto('users')
        .values({
          id: generateId(IdType.User),
          account_id: accountId,
          workspace_id: workspaceId,
          email: account.email,
          name: account.name,
          avatar: account.avatar,
          role: 'guest',
          created_by: inviter.account_id,
          created_at: new Date(),
          status: UserStatus.Active,
          max_file_size: '0',
          storage_limit: '0',
        })
        .onConflict((conflict) =>
          conflict.columns(['workspace_id', 'account_id']).doNothing()
        )
        .returning(['id', 'status', 'role'])
        .executeTakeFirst();
      joined = Boolean(member);
      member ??= await getMembership(trx, workspaceId, accountId);
    }
    if (
      !member ||
      member.status !== UserStatus.Active ||
      member.role === 'none'
    )
      return null;

    await setPageGrant(trx, page.id, member.id, invitation.role);
    await trx
      .deleteFrom('page_invitations')
      .where('token_hash', '=', invitation.token_hash)
      .execute();
    return { workspaceId, pageId: page.id, userId: member.id, joined };
  });
  if (result?.joined) {
    eventBus.publish({
      type: 'user.created',
      accountId,
      workspaceId: result.workspaceId,
      userId: result.userId,
    });
  }
  return result;
};
