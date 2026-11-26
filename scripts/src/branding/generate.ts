import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

// Use the existing server Sharp dependency; no separate renderer or API key.
const sharp = createRequire(
  new URL('../../../apps/server/package.json', import.meta.url)
)('sharp') as typeof import('sharp');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const sourcePath = path.join(root, 'assets/branding/tsuzunowa-symbol.svg');
const images = path.join(root, 'assets/images');
const paper = '#FBF7F1';

const write = async (relative: string, data: string | Buffer) => {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, data);
};

const ico = (entries: { size: number; png: Buffer }[]) => {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, index) => {
    const at = 6 + index * 16;
    header[at] = size === 256 ? 0 : size;
    header[at + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map(({ png }) => png)]);
};

const icns = (entries: { tag: string; png: Buffer }[]) => {
  const chunks = entries.map(({ tag, png }) => {
    const header = Buffer.alloc(8);
    header.write(tag, 0, 'ascii');
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(
    8 + chunks.reduce((size, chunk) => size + chunk.length, 0),
    4
  );
  return Buffer.concat([header, ...chunks]);
};

const component = (svg: string, wordmark: string) => {
  const viewBox = wordmark.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error('Wordmark viewBox missing');
  const width = Number(viewBox.split(' ')[2]);
  const paths = wordmark.slice(
    wordmark.indexOf('>') + 1,
    wordmark.lastIndexOf('</svg>')
  );
  return [
    '// Generated from assets/branding/tsuzunowa-symbol.svg. Run npm run generate:branding -w @colanode/scripts.',
    "import type { ImgHTMLAttributes, SVGProps } from 'react';",
    '',
    'type TsuzunowaLogoProps = ImgHTMLAttributes<HTMLImageElement>;',
    '',
    '// An isolated SVG image keeps its masks/gradients independent of page themes.',
    'const source = ' +
      JSON.stringify('data:image/svg+xml,' + encodeURIComponent(svg)) +
      ';',
    '',
    'export const TsuzunowaLogo = (props: TsuzunowaLogoProps) => {',
    '  return (',
    '    <img src={source} alt="Tsuzunowa" width="100" height="100" {...props} />',
    '  );',
    '};',
    '',
    '// Approved E2 outlines: no installed font or network font request required.',
    'export const TsuzunowaWordmark = (props: SVGProps<SVGSVGElement>) => (',
    `<svg width="${width / 70}em" height="1em" viewBox="${viewBox}" fill="currentColor" role="img" aria-label="Tsuzunowa" {...props}>`,
    paths,
    '</svg>',
    ');',
    '',
    '// Compatibility for existing internal imports.',
    'export const ColanodeLogo = TsuzunowaLogo;',
    '',
  ].join('\n');
};

const generate = async () => {
  const source = await fs.readFile(sourcePath, 'utf8');
  const wordmark = await fs.readFile(
    path.join(root, 'assets/branding/tsuzunowa-wordmark.svg'),
    'utf8'
  );
  const wordmarkSpec = JSON.parse(
    await fs.readFile(path.join(root, 'assets/branding/wordmark.json'), 'utf8')
  );
  const lockupWidth = 172 + wordmarkSpec.lineBox.width + 24;
  const lockupIcon = source.replace(/<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/\s(?:width|height)="[^"]*"/g, '')
      .replace('<svg ', '<svg width="150" height="150" ')
  );
  const lockup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lockupWidth} 150"><rect width="100%" height="100%" fill="${paper}"/>${lockupIcon}${wordmark.replace('<svg ', `<svg x="172" y="40" width="${wordmarkSpec.lineBox.width}" height="70" `)}</svg>\n`;
  await write('assets/branding/tsuzunowa-lockup.svg', lockup);
  await write(
    'assets/images/tsuzunowa-lockup.png',
    await sharp(Buffer.from(lockup)).resize({ width: 1550 }).png().toBuffer()
  );
  await write(
    'assets/images/tsuzunowa-wordmark.png',
    await sharp(Buffer.from(wordmark)).resize({ width: 1400 }).png().toBuffer()
  );
  const body = source.slice(
    source.indexOf('>') + 1,
    source.lastIndexOf('</svg>')
  );
  const backdrop = '<rect width="1254" height="1254" fill="' + paper + '"/>';
  if (body.split(backdrop).length !== 2)
    throw new Error('Expected one approved background');
  const foreground = body.replace(backdrop, '');
  // Same artwork, uniformly inset to fit platform maskable/adaptive safe areas.
  const adaptive =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254"><g transform="translate(627 627) scale(.88) translate(-627 -627)">' +
    foreground +
    '</g></svg>';
  const maskable = adaptive.replace(
    '<g transform=',
    '<rect width="1254" height="1254" fill="' + paper + '"/><g transform='
  );
  const pngs = new Map<number, Buffer>();
  for (const size of [16, 24, 32, 48, 64, 128, 192, 256, 512, 1024]) {
    pngs.set(
      size,
      await sharp(Buffer.from(source))
        .resize(size, size)
        .ensureAlpha()
        .png()
        .toBuffer()
    );
  }
  const png = (size: number) => {
    const result = pngs.get(size);
    if (!result) throw new Error('Missing rendered size');
    return result;
  };
  await fs.mkdir(images, { recursive: true });
  for (const size of [192, 512])
    await write('assets/images/tsuzunowa-logo-' + size + '.png', png(size));
  await write('assets/images/tsuzunowa-logo.png', png(1024));
  await write(
    'assets/images/tsuzunowa-maskable-512.png',
    await sharp(Buffer.from(maskable)).resize(512, 512).png().toBuffer()
  );
  await write(
    'assets/images/tsuzunowa-logo.ico',
    ico(
      [16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: png(size) }))
    )
  );
  const macSizes = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 32],
    ['ic12', 64],
    ['ic13', 256],
    ['ic14', 512],
  ] as const;
  await write(
    'assets/images/tsuzunowa-logo.icns',
    icns(macSizes.map(([tag, size]) => ({ tag, png: png(size) })))
  );
  await write('apps/mobile/assets/icon.png', png(1024));
  await write('apps/mobile/assets/favicon.png', png(64));
  await write('apps/mobile/assets/splash-icon.png', png(512));
  await write(
    'apps/mobile/assets/adaptive-icon.png',
    await sharp(Buffer.from(adaptive)).resize(1024, 1024).png().toBuffer()
  );
  await write(
    'packages/ui/src/components/ui/logo.tsx',
    await format(component(source, wordmark), {
      ...(await resolveConfig(sourcePath)),
      parser: 'typescript',
    })
  );
  await write(
    'assets/branding/manifest.json',
    JSON.stringify(
      {
        source: 'tsuzunowa-symbol.svg',
        sha256: createHash('sha256').update(source).digest('hex'),
        approved: '2026-11-27',
        artwork:
          'Two notebooks bound by one circular ring; editorial t on front cover',
        ring: { frontWidth: 48, exposedRearWidth: 45 },
        wordmark: {
          source: 'tsuzunowa-wordmark.svg',
          selection: 'E2',
          family: 'Fraunces',
          weight: 500,
          sha256: createHash('sha256').update(wordmark).digest('hex'),
        },
        note: 'Source geometry preserved. Maskable/adaptive exports use uniform .88 inset. No small-size redesign.',
      },
      null,
      2
    ) + '\n'
  );
  console.log('Generated Tsuzunowa branding from approved SVG');
};

await generate();
