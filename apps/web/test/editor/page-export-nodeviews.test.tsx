import { act, render, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import TiptapDocument from '@tiptap/extension-document';
import TiptapText from '@tiptap/extension-text';
import { EditorContent } from '@tiptap/react';
import { expect, it, vi } from 'vitest';

import { FileNode } from '@colanode/ui/editor/extensions/file';
import { buildPageExport } from '@colanode/ui/lib/page-export';

// Keep the actual editor extension and React NodeView; isolate file transport.
vi.mock(
  '@colanode/ui/editor/views',
  async () => import('@colanode/ui/editor/views/file')
);
vi.mock('@colanode/ui/components/files/file-block', () => ({
  FileBlock: ({ id }: { id: string }) => (
    <div data-export-image-id={id} data-export-image-name="Body image.png">
      Image preview
    </div>
  ),
}));

it('includes a body image inside the real editable FileNode wrapper', async () => {
  const editor = new Editor({
    extensions: [TiptapDocument, TiptapText, FileNode],
    content: {
      type: 'doc',
      content: [{ type: 'file', attrs: { id: 'imagefi' } }],
    },
  });
  const view = render(<EditorContent editor={editor} />);
  try {
    await waitFor(() =>
      expect(
        view.container.querySelector('file [data-export-image-id="imagefi"]')
      ).not.toBeNull()
    );
    const resolveImage = vi
      .fn()
      .mockResolvedValue(new Blob(['original'], { type: 'image/png' }));
    const html = await buildPageExport(view.container, 'Record', {
      resolveImage,
    });
    const output = new DOMParser().parseFromString(html, 'text/html');
    expect(resolveImage).toHaveBeenCalledExactlyOnceWith('imagefi');
    expect(output.querySelector('img')?.src).toMatch(
      /^data:image\/png;base64,/
    );
    expect(output.querySelector('img')?.alt).toBe('Body image.png');
    expect(output.querySelector('file')).toBeNull();
  } finally {
    view.unmount();
    act(() => editor.destroy());
  }
});
