import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { drivePreviewUrl, readExternalReference } from '@colanode/ui/lib/external-reference';

export const ExternalReferencePreview = ({ value }: { value: unknown }) => {
  const reference = readExternalReference(value);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!reference) return null;
  const preview = drivePreviewUrl(reference);
  return (
    <div className="my-2 rounded-md border p-2" data-external-reference={reference.provider}>
      {preview ? (
        <iframe
          title="Google Drive media preview"
          src={preview}
          width="640"
          height="360"
          style={{ width: '100%', maxWidth: 640, aspectRatio: '16 / 9', height: 'auto', border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          allowFullScreen
        />
      ) : failedUrl === reference.sourceUrl ? (
        <p className="text-sm text-muted-foreground">Unable to display this image. Open the source to view it.</p>
      ) : (
        <img
          src={reference.sourceUrl}
          alt="Externally hosted image"
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ maxWidth: '100%', height: 'auto' }}
          onError={() => setFailedUrl(reference.sourceUrl)}
        />
      )}
      <div className="mt-1 flex flex-wrap gap-2 text-sm">
        <a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-blue-500 underline">Open source</a>
        {preview && <span className="text-muted-foreground">If the preview is unavailable, open the file in Google Drive.</span>}
      </div>
    </div>
  );
};

const widgetRoots = new WeakMap<HTMLElement, Root>();

// Mount only a preview widget. The paragraph itself keeps its native DOM.
export const createExternalReferenceWidget = (
  value: unknown,
  onRemove?: () => void
): HTMLElement => {
  const dom = document.createElement('div');
  dom.contentEditable = 'false';
  dom.dataset.externalReferenceWidget = '';
  const root = createRoot(dom);
  widgetRoots.set(dom, root);
  root.render(
    <>
      <ExternalReferencePreview value={value} />
      {onRemove && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={onRemove}
        >
          Remove preview and keep link
        </button>
      )}
    </>
  );
  return dom;
};

export const destroyExternalReferenceWidget = (dom: Node) => {
  const root = widgetRoots.get(dom as HTMLElement);
  if (!root) return;
  widgetRoots.delete(dom as HTMLElement);
  // A remove button can dispatch while React is handling this widget's event.
  // Defer unmount to finish that event, including when the editor is destroyed.
  queueMicrotask(() => root.unmount());
};
