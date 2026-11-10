import { fireEvent, render, screen } from '@testing-library/react';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Link from '@tiptap/extension-link';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buildEditorContent, mapContentsToBlocks } from '@colanode/client/lib/editor';
import { richTextContentSchema, type RichTextContent } from '@colanode/core';
import { YDoc } from '@colanode/crdt';
import { IdExtension } from '@colanode/ui/editor/extensions/id';
import { ParagraphNode } from '@colanode/ui/editor/extensions/paragraph';
import { ExternalReferencePreview } from '@colanode/ui/editor/views/external-reference';
import { drivePreviewUrl, externalReferenceParagraph, parseExternalReference, readExternalReference } from '@colanode/ui/lib/external-reference';

const url = 'https://drive.google.com/file/d/ExampleFile_123/view?resourcekey=example-key';

describe('external media references', () => {
  it('limits iframe sources to recognized Drive file URLs', () => {
    const ref = parseExternalReference(url)!;
    expect(drivePreviewUrl(ref)).toBe('https://drive.google.com/file/d/ExampleFile_123/preview?resourcekey=example-key');
    for (const input of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'http://example.invalid/image.png', 'https://user:password@example.invalid/image.png', 'https://drive.google.com/drive/folders/example', 'https://example.invalid/image.png?access_token=example', 'https://example.invalid/image.png?X-Amz-Signature=example', 'https://example.invalid/image.png?api_key=example', 'https://example.invalid/image.png?apikey=example', 'https://example.invalid/image.png?sig=example', 'https://example.invalid/image.png?AWSAccessKeyId=example']) {
      expect(parseExternalReference(input)).toBeNull();
    }
    expect(parseExternalReference('https://images.example.invalid/photo.png?width=640&key=thumbnail')?.provider).toBe('direct-image');
    expect(readExternalReference({ ...ref, fileId: 'DifferentFile' })).toBeNull();
    expect(parseExternalReference('https://drive.google.com.example.invalid/image.png')?.provider).toBe('direct-image');
    const html = renderToStaticMarkup(<ExternalReferencePreview value={ref} />);
    expect(html).toContain('<iframe');
    expect(html).toContain('Google Drive media preview');
    expect(html).toContain('Open source');
    expect(html).not.toContain('autoplay');
  });

  it('preserves source links and surrounding text across Yjs and an older editor schema', () => {
    const ref = parseExternalReference(url)!;
    const paragraph = externalReferenceParagraph(ref);
    const text = (id: string, value: string) => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text: value }] });
    const content = { type: 'doc', content: [text('before', 'Original before'), { ...paragraph, attrs: { ...paragraph.attrs, id: 'reference' } }, text('after', 'Original after')] };
    const indexes = new Map([['before', 'a0'], ['reference', 'a1'], ['after', 'a2']]);
    const schema = getSchema([Document, ParagraphNode, Text, Link, IdExtension]);
    const blocks = mapContentsToBlocks('record', schema.nodeFromJSON(content).toJSON().content!, indexes);
    const ydoc = new YDoc();
    const update = ydoc.update(richTextContentSchema, { type: 'rich_text', blocks })!;
    const independent = new YDoc(); independent.applyUpdate(update);
    const reloaded = buildEditorContent('record', independent.getObject<RichTextContent>());
    expect(reloaded.content?.[1]?.attrs?.externalRef).toEqual(ref);
    const oldSchema = getSchema([Document, Paragraph, Text, Link, IdExtension]);
    const oldContent = oldSchema.nodeFromJSON(reloaded).toJSON();
    expect(oldContent.content?.[1]?.attrs?.externalRef).toBeUndefined();
    expect(oldContent.content?.[1]?.content?.[0]?.text).toBe(ref.sourceUrl);
    expect(oldContent.content?.[1]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(ref.sourceUrl);
    const oldBlocks = mapContentsToBlocks('record', oldContent.content!, indexes);
    expect(oldBlocks.before?.content).toEqual(blocks.before?.content);
    expect(oldBlocks.after?.content).toEqual(blocks.after?.content);
  });

  it('retains the source link when a direct image cannot load', () => {
    render(<ExternalReferencePreview value={parseExternalReference('https://images.example.invalid/photo.png')} />);
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Unable to display this image. Open the source to view it.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', 'https://images.example.invalid/photo.png');
  });
});
