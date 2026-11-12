import { Migration } from 'kysely';

export const createPageInvitationsTable: Migration = {
  up: async (db) => {
    await db.schema
      .alterTable('page_shares')
      .addColumn('role', 'varchar(12)', (col) =>
        col.notNull().defaultTo('viewer')
      )
      .execute();

    await db.schema
      .createTable('page_invitations')
      .addColumn('page_id', 'varchar(30)', (col) =>
        col.notNull().references('nodes.id').onDelete('cascade')
      )
      .addColumn('email', 'varchar(256)', (col) => col.notNull())
      .addColumn('token_hash', 'varchar(64)', (col) => col.notNull().unique())
      .addColumn('inviter_id', 'varchar(30)', (col) =>
        col.notNull().references('users.id').onDelete('cascade')
      )
      .addColumn('role', 'varchar(12)', (col) => col.notNull())
      .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
      .addPrimaryKeyConstraint('page_invitations_pkey', ['page_id', 'email'])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable('page_invitations').execute();
    await db.schema.alterTable('page_shares').dropColumn('role').execute();
  },
};
