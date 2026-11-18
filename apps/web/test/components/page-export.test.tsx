import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PageExport } from '@colanode/ui/components/pages/page-export';
import { SharedFileBlock } from '@colanode/ui/components/pages/shared-file';
import * as exports from '@colanode/ui/lib/page-export';

vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'reader' }),
}));
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: false }),
}));
vi.mock('@colanode/ui/components/files/file-save-button', () => ({
  FileSaveButton: () => null,
}));

it('exports a readable page without editing rights and previews only its body for PDF printing', async () => {
  const download = vi
    .spyOn(exports, 'downloadPageHtml')
    .mockImplementation(() => {});
  render(
    <>
      <aside>Unrelated sidebar</aside>
      <PageExport title="共有仕様">
        <p>Read-only body</p>
      </PageExport>
    </>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Export page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download HTML' }));
  await waitFor(() => expect(download).toHaveBeenCalledOnce());
  expect(download.mock.calls[0]![0]).toContain('Read-only body');
  expect(download.mock.calls[0]![0]).not.toContain('Unrelated sidebar');
  fireEvent.click(screen.getByRole('button', { name: 'PDF preview' }));
  const frame = (await screen.findByTitle(
    'Page export preview'
  )) as HTMLIFrameElement;
  expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
  expect(frame.srcdoc).toContain('共有仕様');
  const print = vi
    .spyOn(frame.contentWindow!, 'print')
    .mockImplementation(() => {});
  vi.spyOn(frame.contentWindow!, 'focus').mockImplementation(() => {});
  fireEvent.load(frame);
  fireEvent.click(screen.getByRole('button', { name: 'Print / Save as PDF' }));
  expect(print).toHaveBeenCalledOnce();
});

it('includes an unpreviewed image using the current reader’s authorized original download', async () => {
  const download = vi
    .spyOn(exports, 'downloadPageHtml')
    .mockImplementation(() => {});
  const executeQuery = vi.fn().mockResolvedValue({
    url: 'http://localhost/image-original',
    headers: { Authorization: 'Bearer synthetic-test-token' },
  });
  Object.assign(window, { colanode: { executeQuery } });
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['full image bytes'], { type: 'image/png' }),
  });
  vi.stubGlobal('fetch', fetch);
  render(
    <PageExport title="Images">
      <SharedFileBlock
        file={{ id: 'image1', name: 'Original.png', subtype: 'image' }}
      />
    </PageExport>
  );
  expect(screen.queryByRole('img')).toBeNull();
  expect(executeQuery).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Export page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download HTML' }));
  await waitFor(() => expect(download).toHaveBeenCalledOnce());
  expect(executeQuery).toHaveBeenCalledExactlyOnceWith({
    type: 'file.download.request.get',
    id: 'image1',
    userId: 'reader',
  });
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost/image-original',
    expect.objectContaining({
      headers: { Authorization: 'Bearer synthetic-test-token' },
      cache: 'no-store',
    })
  );
  expect(download.mock.calls[0]![0]).toContain('data:image/png;base64,');
  expect(download.mock.calls[0]![0]).not.toContain('synthetic-test-token');
});
