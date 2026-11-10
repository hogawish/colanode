export interface ExternalReference {
  version: 1;
  provider: 'drive' | 'direct-image';
  sourceUrl: string;
  fileId?: string;
}

export const parseExternalReference = (input: string): ExternalReference | null => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  // Best-effort rejection of common credential/signature parameters, not a
  // guarantee that a URL contains no credentials or is safe to persist/share.
  for (const key of url.searchParams.keys()) {
    if (/^(access_token|token|authorization|signature|api[_-]?key|sig|awsaccesskeyid|x-amz-.+|x-goog-.+)$/i.test(key)) {
      return null;
    }
  }
  if (url.hostname === 'drive.google.com') {
    if (url.port) return null;
    const match = /^\/file\/d\/([A-Za-z0-9_-]+)\/(?:view|preview)\/?$/.exec(url.pathname);
    if (!match) return null;
    return { version: 1, provider: 'drive', sourceUrl: url.href, fileId: match[1] };
  }
  return { version: 1, provider: 'direct-image', sourceUrl: url.href };
};

export const readExternalReference = (value: unknown): ExternalReference | null => {
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<ExternalReference>;
  if (stored.version !== 1 || typeof stored.sourceUrl !== 'string') return null;
  const parsed = parseExternalReference(stored.sourceUrl);
  if (!parsed || parsed.provider !== stored.provider || parsed.fileId !== stored.fileId) return null;
  return parsed;
};

export const drivePreviewUrl = (reference: ExternalReference): string | null => {
  const checked = readExternalReference(reference);
  if (!checked || checked.provider !== 'drive' || !checked.fileId) return null;
  const preview = new URL(`https://drive.google.com/file/d/${checked.fileId}/preview`);
  const resourceKey = new URL(checked.sourceUrl).searchParams.get('resourcekey');
  if (resourceKey) preview.searchParams.set('resourcekey', resourceKey);
  return preview.href;
};

export const externalReferenceParagraph = (reference: ExternalReference) => ({
  type: 'paragraph',
  attrs: { externalRef: reference },
  content: [{
    type: 'text',
    text: reference.sourceUrl,
    marks: [{ type: 'link', attrs: { href: reference.sourceUrl, target: '_blank', rel: 'noopener noreferrer' } }],
  }],
});
