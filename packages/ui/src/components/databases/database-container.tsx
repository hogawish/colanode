import { LocalDatabaseNode } from '@colanode/client/types';
import { NodeRole } from '@colanode/core';
import { Database } from '@colanode/ui/components/databases/database';
import { DatabaseViews } from '@colanode/ui/components/databases/database-views';
import { PageExport } from '@colanode/ui/components/pages/page-export';

interface DatabaseContainerProps {
  database: LocalDatabaseNode;
  role: NodeRole;
}

export const DatabaseContainer = ({
  database,
  role,
}: DatabaseContainerProps) => {
  return (
    <Database database={database} role={role}>
      <PageExport title={database.name} nodeId={database.id}>
        <DatabaseViews />
      </PageExport>
    </Database>
  );
};
