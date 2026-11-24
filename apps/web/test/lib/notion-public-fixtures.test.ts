import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { previewNotionZip } from '@colanode/ui/lib/notion-import';

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
