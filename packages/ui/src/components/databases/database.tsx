import { ReactNode, useCallback } from 'react';

import { LocalDatabaseNode } from '@colanode/client/types';
import { NodeRole, hasNodeRole } from '@colanode/core';
import { DatabaseContext } from '@colanode/ui/contexts/database';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface DatabaseProps {
  database: LocalDatabaseNode;
  role: NodeRole;
  shared?: boolean;
  children: ReactNode;
}

export const Database = ({
  database,
  role,
  shared = false,
  children,
}: DatabaseProps) => {
  const workspace = useWorkspace();

  const canEdit = !shared && hasNodeRole(role, 'editor');
  const isLocked = database.locked ?? false;
  const canCreateRecord = canEdit;

  const toggleLock = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const nodes = workspace.collections.nodes;
    nodes.update(database.id, (draft) => {
      if (draft.type !== 'database') {
        return;
      }

      const currentLocked = draft.locked ?? false;
      draft.locked = !currentLocked;
    });
  }, [canEdit, database.id, workspace.userId]);

  return (
    <DatabaseContext.Provider
      value={{
        id: database.id,
        name: database.name,
        nameField: database.nameField,
        role,
        shared,
        fields: Object.values(database.fields),
        canEdit: canEdit,
        isLocked,
        canCreateRecord,
        rootId: database.rootId,
        toggleLock,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
