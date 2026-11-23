import { Download, Settings } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { NotionTransfer } from '@colanode/ui/components/pages/notion-transfer';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  downloadNotionPageZip,
  downloadNotionZip,
} from '@colanode/ui/lib/notion-page-export';
import { buildNotionTreeZip } from '@colanode/ui/lib/notion-tree-export';
import {
  buildPageExport,
  downloadPageHtml,
} from '@colanode/ui/lib/page-export';

const ExportContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

// One controller per node container keeps the settings menu and body together,
// including when a database and a record modal are open at the same time.
export const PageExportProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <ExportContext.Provider value={{ open, setOpen }}>
      {children}
    </ExportContext.Provider>
  );
};

export const PageExportMenuItem = () => {
  const controller = useContext(ExportContext);
  if (!controller) return null;
  return (
    <DropdownMenuItem onSelect={() => controller.setOpen(true)}>
      <Download className="size-4" />
      Export page
    </DropdownMenuItem>
  );
};

// Shared pages have no normal NodeSettings toolbar, so provide the same gear
// entry there. Ordinary page/record/database containers use their existing gear.
export const PageExportSettings = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Page settings">
        <Settings className="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <PageExportMenuItem />
    </DropdownMenuContent>
  </DropdownMenu>
);

export const PageExport = ({
  title,
  children,
  nodeId,
}: {
  title: string;
  children: ReactNode;
  nodeId?: string;
}) => {
  const { userId, workspaceId } = useWorkspace();
  const body = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLIFrameElement>(null);
  const controller = useContext(ExportContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = controller?.open ?? localOpen;
  const setOpen = controller?.setOpen ?? setLocalOpen;
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [includeChildren, setIncludeChildren] = useState(true);
  const resolveImage = async (id: string) => {
    const request = await window.colanode.executeQuery({
      type: 'file.download.request.get',
      id,
      userId,
    });
    if (!request)
      throw new Error(
        'A page image is unavailable. Please check its access and try again.'
      );
    const response = await fetch(request.url, {
      headers: request.headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        'Could not load a page image. Please check its access and try again.'
      );
    return response.blob();
  };
  useEffect(() => {
    if (open) {
      setHtml(null);
      setError(null);
      setReady(false);
    }
  }, [open]);
  const buildTree = async () => {
    if (!nodeId) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const result = await buildNotionTreeZip(nodeId, {
        read: async (id, offset) => {
          const response = await window.colanode.executeMutation({
            type: 'page.share',
            action: 'read-export',
            pageId: id,
            offset,
            userId,
          });
          if (!response.success) throw new Error(response.error.message);
          if (response.output.action !== 'read-export')
            throw new Error('The server did not return export content.');
          return response.output.snapshot;
        },
        resolveImage,
        sourceUrl: (id) =>
          new URL(
            `/${encodeURIComponent(workspaceId)}/${encodeURIComponent(id)}`,
            window.location.origin
          ).href,
        onProgress: setProgress,
      });
      downloadNotionZip(result.bytes, title);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not export this hierarchy.'
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };
  const build = async (format: 'html' | 'pdf' | 'notion') => {
    if (!body.current) return;
    setBusy(true);
    setError(null);
    setReady(false);
    try {
      const result = await buildPageExport(body.current, title, {
        resolveImage,
      });
      if (format === 'html') downloadPageHtml(result, title);
      else if (format === 'notion') downloadNotionPageZip(result, title);
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
      <div ref={body} className="min-w-0">
        {children}
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          className={
            html
              ? 'sm:max-w-4xl max-h-[90vh] overflow-y-auto'
              : 'max-h-[90vh] overflow-y-auto'
          }
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Export page</DialogTitle>
            <DialogDescription>
              HTML / PDF include this page and its images. Import the Notion ZIP
              via Notion’s Import → ZIP. Database views, relations, permissions
              and history are not preserved in ZIP.
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
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                void (includeChildren && nodeId ? buildTree() : build('notion'))
              }
            >
              Notion ZIP
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
          {nodeId && (
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeChildren}
                  disabled={busy}
                  onChange={(event) => setIncludeChildren(event.target.checked)}
                />
                Include subpages &amp; databases in Notion ZIP
              </label>
              <p className="text-muted-foreground">
                {includeChildren
                  ? 'Uses synced content and all readable descendant rows. Wait for edits to sync first. Databases are CSV with linked row bodies and images.'
                  : 'This page and its images only. Child pages remain links; embedded databases include displayed rows.'}
              </p>
            </div>
          )}
          {busy && (
            <p role="status">
              Preparing export…
              {progress !== null ? ` ${progress} pages read` : ''}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {nodeId && open && (
            <NotionTransfer nodeId={nodeId} disabled={busy} onBusy={setBusy} />
          )}
          {html && (
            <iframe
              ref={preview}
              title="Page export preview"
              className="h-[60vh] w-full rounded border bg-white"
              sandbox="allow-same-origin allow-modals"
              srcDoc={html}
              onLoad={() => {
                const images = Array.from(
                  preview.current?.contentDocument?.images ?? []
                );
                if (
                  images.some(
                    (image) => !image.complete || image.naturalWidth === 0
                  )
                ) {
                  setError(
                    'An image could not be displayed in the PDF preview. Please check the image format and try again.'
                  );
                  setReady(false);
                } else setReady(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
