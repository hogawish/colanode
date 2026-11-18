import { Download } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';

import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import {
  buildPageExport,
  downloadPageHtml,
} from '@colanode/ui/lib/page-export';

export const PageExport = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  const body = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const build = async (format: 'html' | 'pdf') => {
    if (!body.current) return;
    setBusy(true);
    setError(null);
    setReady(false);
    try {
      const result = await buildPageExport(body.current, title);
      if (format === 'html') downloadPageHtml(result, title);
      else setHtml(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not export this page.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mb-2 flex justify-end" data-export-exclude>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setHtml(null);
            setError(null);
            setOpen(true);
          }}
        >
          <Download className="size-4" />
          Export page
        </Button>
      </div>
      <div ref={body} className="min-w-0">
        {children}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={html ? 'sm:max-w-4xl' : ''}>
          <DialogHeader>
            <DialogTitle>Export page</DialogTitle>
            <DialogDescription>
              This page only. Child pages remain links. Embedded databases
              include currently displayed rows. HTML includes the images loaded
              on this page. PDF uses your browser’s Save as PDF option.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void build('html')}>
              Download HTML
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void build('pdf')}
            >
              PDF preview
            </Button>
            {html && (
              <Button
                disabled={!ready || busy}
                onClick={() => {
                  preview.current?.contentWindow?.focus();
                  preview.current?.contentWindow?.print();
                }}
              >
                Print / Save as PDF
              </Button>
            )}
          </div>
          {busy && <p role="status">Preparing export…</p>}
          {error && <p role="alert">{error}</p>}
          {html && (
            <iframe
              ref={preview}
              title="Page export preview"
              className="h-[60vh] w-full rounded border bg-white"
              sandbox="allow-same-origin allow-modals"
              srcDoc={html}
              onLoad={() => setReady(true)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
