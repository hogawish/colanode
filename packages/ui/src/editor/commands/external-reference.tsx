import type { Editor } from '@tiptap/core';
import { Link2 } from 'lucide-react';
import { useState } from 'react';

import { EditorCommand } from '@colanode/client/types';
import { Button } from '@colanode/ui/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@colanode/ui/components/ui/dialog';
import { Input } from '@colanode/ui/components/ui/input';
import { externalReferenceParagraph, parseExternalReference } from '@colanode/ui/lib/external-reference';

export interface ExternalReferenceRequest { editor: Editor }

export const createExternalReferenceCommand = (request: (value: ExternalReferenceRequest) => void): EditorCommand => ({
  key: 'external-reference',
  name: 'Embed',
  description: 'Reference Google Drive media or an external image by URL',
  keywords: ['embed', 'drive', 'image', 'video'],
  icon: Link2,
  disabled: false,
  handler({ editor, range }) {
    if (editor.isDestroyed || !editor.isEditable) return;
    // Consume the slash token now, before a dialog or remote edit can stale it.
    editor.chain().deleteRange(range).run();
    request({ editor });
  },
});

export const ExternalReferenceDialog = ({ request, onClose }: { request: ExternalReferenceRequest; onClose: () => void }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Embed</DialogTitle>
          <DialogDescription>Paste a Google Drive file link or a direct image URL. Existing source permissions still apply.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(event) => {
          event.preventDefault();
          const reference = parseExternalReference(url);
          if (!reference) { setError('Enter an HTTPS Google Drive file link or a direct image URL without credentials.'); return; }
          if (request.editor.isDestroyed) { onClose(); return; }
          request.editor.chain().focus().insertContent(externalReferenceParagraph(reference)).run();
          onClose();
        }}>
          <Input type="url" aria-label="Source URL" placeholder="https://drive.google.com/file/d/…/view" value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} required />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit">Embed</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
