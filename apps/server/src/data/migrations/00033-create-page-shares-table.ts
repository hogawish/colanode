import { Migration } from 'kysely';

export const createPageSharesTable: Migration = {
  up: async (db) => {
    await db.schema
      .createTable('page_shares')
      .addColumn('page_id', 'varchar(30)', (column) =>
        column.notNull().references('nodes.id').onDelete('cascade')
      )
      .addColumn('viewer_id', 'varchar(30)', (column) =>
        column.notNull().references('users.id').onDelete('cascade')
      )
      .addPrimaryKeyConstraint('page_shares_pkey', ['page_id', 'viewer_id'])
      .execute();
    await db.schema
      .createIndex('page_shares_viewer_idx')
      .on('page_shares')
      .column('viewer_id')
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable('page_shares').execute();
  },
};
