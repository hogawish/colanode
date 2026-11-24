import type { FileSubtype } from '@colanode/core';

// Media is copied, never transcoded. Unknown formats remain ordinary files.
export const attachmentMime = (path: string) => {
  const extension = path.split('.').at(-1)!.toLowerCase();
  return (
    (
      {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        avif: 'image/avif',
        bmp: 'image/bmp',
        heic: 'image/heic',
        ico: 'image/x-icon',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        m4v: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mpeg: 'video/mpeg',
        mpg: 'video/mpeg',
        ogv: 'video/ogg',
        avi: 'video/x-msvideo',
        mkv: 'video/x-matroska',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        oga: 'audio/ogg',
        m4a: 'audio/mp4',
        flac: 'audio/flac',
        aac: 'audio/aac',
        pdf: 'application/pdf',
        txt: 'text/plain',
        csv: 'text/csv',
        md: 'text/markdown',
        json: 'application/json',
        zip: 'application/zip',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      } as Record<string, string>
    )[extension] ?? 'application/octet-stream'
  );
};
export const attachmentSubtype = (mime: string): FileSubtype =>
  mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('video/')
      ? 'video'
      : mime.startsWith('audio/')
        ? 'audio'
        : mime === 'application/pdf'
          ? 'pdf'
          : 'other';
export type ExportAttachment = {
  id: string;
  name: string;
  mimeType: string;
  subtype: FileSubtype;
};

export const markExportAttachment = (
  element: HTMLElement,
  file: ExportAttachment
) => {
  element.dataset.exportAttachmentId = file.id;
  element.dataset.exportAttachmentName = file.name;
  element.dataset.exportAttachmentMime = file.mimeType;
  element.dataset.exportAttachmentSubtype = file.subtype;
};

// Paths and visible names are separate: a user's display-name edit must not
// remove the original extension or change the bytes' detected media type.
export const attachmentFilename = (name: string, mime: string) => {
  let value =
    Array.from(name.replace(/[<>:"/\\|?*]/g, '_'), (c) =>
      c.charCodeAt(0) < 32 ? '_' : c
    )
      .slice(0, 160)
      .join('')
      .replace(/[. ]+$/g, '')
      .trim() || 'attachment';
  if (!/\.[a-z\d]{1,12}$/i.test(value)) {
    const ext = (
      {
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'application/pdf': 'pdf',
        'text/plain': 'txt',
        'application/zip': 'zip',
      } as Record<string, string>
    )[mime];
    if (ext) value += '.' + ext;
  }
  return value;
};
