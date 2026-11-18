import { useState } from 'react';

import { LocalPageNode } from '@colanode/client/types';
import { NodeRole, hasNodeRole } from '@colanode/core';
import { Document } from '@colanode/ui/components/documents/document';
import { PageExport } from '@colanode/ui/components/pages/page-export';
import { Input } from '@colanode/ui/components/ui/input';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface PageContainerProps {
  page: LocalPageNode;
  role: NodeRole;
}

const PageTitle = ({
  page,
  canEdit,
}: {
  page: LocalPageNode;
  canEdit: boolean;
}) => {
  const { collections } = useWorkspace();
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    setDraft(null);
    if (!canEdit || draft === null) return;
    const name = draft.trim() || 'Untitled';
    if (name === page.name || !collections.nodes.has(page.id)) return;
    collections.nodes.update(page.id, (node) => {
      if (node.type === 'page') node.name = name;
    });
  };

  return (
    <Input
      aria-label="Page title"
      value={draft ?? page.name}
      readOnly={!canEdit}
      className="mb-4 h-auto min-w-0 border-none px-1 py-1 font-heading text-2xl font-bold shadow-none focus-visible:ring-0 md:text-4xl"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (!canEdit || event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(null);
        }
      }}
    />
  );
};

export const PageContainer = ({ page, role }: PageContainerProps) => {
  const canEdit = hasNodeRole(role, 'editor');
  return (
    <PageExport title={page.name}>
      <PageTitle key={page.id} page={page} canEdit={canEdit} />
      <Document node={page} canEdit={canEdit} autoFocus="start" />
    </PageExport>
  );
};
