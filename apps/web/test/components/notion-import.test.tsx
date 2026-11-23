import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { expect, it, vi } from 'vitest';

import { NotionImportDialog } from '@colanode/ui/components/pages/notion-import-dialog';

vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'editor', workspaceId: 'workspace' }),
}));
it('previews before writing and then links to fresh imported pages', async () => {
  const bytes = zipSync({ 'Page.md': strToU8('# Page\n\nHello **world**') });
  const file = new File([new Uint8Array(bytes)], 'notion.zip', {
    type: 'application/zip',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer,
  });
  const executeMutation = vi
    .fn()
    .mockResolvedValue({ success: true, output: {} });
  Object.assign(window, { colanode: { executeMutation } });
  render(<NotionImportDialog parentId="parent" onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('Notion export ZIP'), {
    target: { files: [file] },
  });
  await screen.findByText('1 pages · 0 databases · 0 rows · 0 images');
  expect(executeMutation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import as new pages' }));
  await screen.findByRole('link', { name: 'Open imported pages' });
  await waitFor(() => expect(executeMutation).toHaveBeenCalledTimes(3));
  expect(executeMutation.mock.calls[0]?.[0]).toMatchObject({
    type: 'node.create',
    attributes: { type: 'page', parentId: 'parent' },
  });
  expect(executeMutation.mock.calls[2]?.[0].type).toBe('document.update');
});
