import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PageExport } from '@colanode/ui/components/pages/page-export';
import * as exports from '@colanode/ui/lib/page-export';

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
