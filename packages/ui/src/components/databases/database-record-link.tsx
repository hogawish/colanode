import type { ReactNode } from 'react';

import { Link } from '@colanode/ui/components/ui/link';
import { useDatabase } from '@colanode/ui/contexts/database';

export const DatabaseRecordLink = ({
  recordId,
  children,
  className,
  full = false,
}: {
  recordId: string;
  children: ReactNode;
  className?: string;
  full?: boolean;
}) => {
  const database = useDatabase();
  if (database.shared) return <div className={className}>{children}</div>;
  return full ? (
    <Link
      from="/workspace/$userId"
      to="$nodeId"
      params={{ nodeId: recordId }}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <Link
      from="/workspace/$userId/$nodeId"
      to="modal/$modalNodeId"
      params={{ modalNodeId: recordId }}
      className={className}
      draggable={false}
    >
      {children}
    </Link>
  );
};
