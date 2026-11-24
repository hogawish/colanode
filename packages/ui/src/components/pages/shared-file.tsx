import { createContext, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

import type { SharedFile } from '@colanode/client/mutations';
import { FileIcon } from '@colanode/ui/components/files/file-icon';
import { FileSaveButton } from '@colanode/ui/components/files/file-save-button';
import { FilePreviewAudio } from '@colanode/ui/components/files/previews/file-preview-audio';
import { FilePreviewImage } from '@colanode/ui/components/files/previews/file-preview-image';
import { FilePreviewVideo } from '@colanode/ui/components/files/previews/file-preview-video';
import { Button } from '@colanode/ui/components/ui/button';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export const SharedFilesContext = createContext<ReadonlyMap<
  string,
  SharedFile
> | null>(null);

export const SharedFileBlock = ({ file }: { file: SharedFile }) => {
  const { userId } = useWorkspace();
  const [playableRequested, setPlayableRequested] = useState(false);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px',
    fallbackInView: true,
  });
  const isImage = file.subtype === 'image';
  const isPlayable = file.subtype === 'audio' || file.subtype === 'video';
  const load = (isImage && inView) || (isPlayable && playableRequested);

  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setPreview(undefined);

    const fetchPreview = async () => {
      const request = await window.colanode.executeQuery({
        type: 'file.download.request.get',
        id: file.id,
        userId,
      });
      if (!request) throw new Error('File is unavailable.');
      const response = await fetch(request.url, {
        headers: request.headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('File is unavailable.');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview(objectUrl);
    };
    void fetchPreview().catch(() => {
      if (!controller.signal.aborted) setPreview(null);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, userId, load]);

  return (
    <div
      ref={ref}
      data-document-block={file.id}
      className="my-1 w-full"
      data-export-image-id={isImage ? file.id : undefined}
      data-export-image-name={isImage ? file.name : undefined}
      data-export-attachment-id={file.id}
      data-export-attachment-name={file.name}
      data-export-attachment-mime={file.mimeType}
      data-export-attachment-subtype={file.subtype}
    >
      {(isImage || (isPlayable && playableRequested)) && (
        <div className="flex h-72 max-w-lg items-center justify-center overflow-hidden rounded-md p-2">
          {preview ? (
            isImage ? (
              <FilePreviewImage url={preview} name={file.name} />
            ) : file.subtype === 'video' ? (
              <FilePreviewVideo url={preview} />
            ) : (
              <FilePreviewAudio url={preview} name={file.name} />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {preview === null ? 'Preview unavailable' : 'Loading preview…'}
            </p>
          )}
        </div>
      )}
      <div className="flex max-w-lg items-center gap-2">
        {!isImage && (
          <FileIcon
            mimeType={file.mimeType ?? ''}
            className="size-8 shrink-0"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
        {isPlayable && !playableRequested && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlayableRequested(true)}
          >
            Preview
          </Button>
        )}
        <FileSaveButton file={file} remoteOnly />
      </div>
    </div>
  );
};
