import { JSONContent } from '@tiptap/core';
import { useContext } from 'react';

import { FileBlock } from '@colanode/ui/components/files/file-block';
import {
  SharedFileBlock,
  SharedFilesContext,
} from '@colanode/ui/components/pages/shared-file';

interface FileRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const FileRenderer = ({ node }: FileRendererProps) => {
  const id = node.attrs?.id;
  const files = useContext(SharedFilesContext);
  if (!id) {
    return null;
  }

  if (files) {
    const file = files.get(id);
    return file ? <SharedFileBlock key={file.id} file={file} /> : null;
  }
  return <FileBlock id={id} />;
};
