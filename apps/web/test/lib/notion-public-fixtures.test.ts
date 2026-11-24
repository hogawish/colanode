import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { richTextContentSchema, extractDocumentText } from '@colanode/core';
import { YDoc } from '@colanode/crdt';
import {
  previewNotionZip,
  importNotionPlan,
} from '@colanode/ui/lib/notion-import';

// Optional release check against externally supplied, pinned real Notion exports.
// The upstream archives are test data, never executed or redistributed here.
const directory = process.env.NOTION_REAL_FIXTURE_DIR;
it.runIf(!!directory).each(['Notion.Test.Export.zip', 'notion-testspace.zip'])(
  'reads the real Notion export envelope %s',
  (name) => {
    const plan = previewNotionZip(
      new Uint8Array(readFileSync(path.join(directory!, name)))
    );
    expect(plan.items.length).toBeGreaterThan(1);
    expect(plan.items.some((item) => !!item.parent)).toBe(true);
    if (name === 'Notion.Test.Export.zip')
      expect(plan.items.some((item) => item.kind === 'database')).toBe(true);
    if (name === 'notion-testspace.zip')
      expect(plan.images.length).toBeGreaterThan(0);
    expect(
      plan.items.every((item) =>
        item.body.every((block) => block.type !== 'script')
      )
    ).toBe(true);
    const result = {
      fixture: name,
      pages: plan.items.filter((item) => item.kind === 'page').length,
      databases: plan.items.filter((item) => item.kind === 'database').length,
      records: plan.items.filter((item) => item.kind === 'record').length,
      images: plan.images.length,
      attachments: plan.attachments.length,
      warnings: plan.warnings,
      referencedFilesPresent: plan.attachments.every((file) =>
        Object.hasOwn(plan.files, file.path)
      ),
    };
    writeFileSync(
      path.join(directory!, name + '.result.json'),
      JSON.stringify(result, null, 2)
    );
    expect(result.referencedFilesPresent).toBe(true);
  }
);

it.runIf(!!directory).each(['notion-testspace.zip', 'Notion.Test.Export.zip'])(
  'writes real Notion pages and records without cyclic document references: %s',
  async (fixture) => {
    const plan = previewNotionZip(
      new Uint8Array(readFileSync(path.join(directory!, fixture)))
    );
    const names = new Map<string, string>();
    let files = 0,
      documents = 0;
    Object.defineProperty(window, 'colanode', {
      configurable: true,
      value: {
        saveTempFile: vi.fn(async () => ({ id: 'temp' })),
        executeMutation: vi.fn(async (input: Record<string, unknown>) => {
          if (input.type === 'node.create')
            names.set(
              input.nodeId as string,
              (input.attributes as { name: string }).name
            );
          if (input.type === 'file.create')
            return { success: true, output: { id: 'fixture-file-' + ++files } };
          if (input.type === 'document.update') {
            const content = richTextContentSchema.parse(
              new YDoc(input.update as string).getObject()
            );
            expect(
              Object.values(content.blocks).some(
                (block) =>
                  block.id === input.documentId || block.id === block.parentId
              ),
              names.get(input.documentId as string)
            ).toBe(false);
            expect(() =>
              extractDocumentText(input.documentId as string, content)
            ).not.toThrow();
            documents++;
          }
          return { success: true, output: {} };
        }),
      },
    });
    await importNotionPlan(plan, {
      userId: 'synthetic',
      workspaceId: 'synthetic',
      parentId: 'synthetic',
    });
    expect(documents).toBe(
      plan.items.filter((item) => item.kind !== 'database').length
    );
    expect(files).toBeGreaterThanOrEqual(plan.attachments.length);
  }
);
