// Export the current reader's page and its referenced images. No traversal
// of child pages or requests for additional database records or private files.
const tags = new Set(
  'a article b blockquote br code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img label li ol p pre s section span strong sub summary sup table tbody td th thead tr u ul'.split(
    ' '
  )
);
// Editable Tiptap NodeViews use custom host elements. Preserve their sanitized
// children in ordinary HTML containers instead of dropping the entire block.
const nodeViewTags = new Map([
  ['file', 'div'],
  ['database', 'div'],
  ['page', 'div'],
  ['folder', 'div'],
  ['code-block', 'div'],
  ['mention', 'span'],
]);
const styles = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'text-decoration-line',
  'text-align',
  'white-space',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'margin-top',
  'margin-bottom',
  'border-color',
  'border-style',
  'border-width',
  'display',
  'flex-direction',
  'gap',
  'list-style-type',
];
const safeLink = (value: string) => {
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
};
const blobImageData = async (blob: Blob) => {
  // Some storage download responses omit Content-Type, including cached blob
  // URLs. Recognize actual image signatures rather than trusting a filename or
  // treating an arbitrary untyped response as an image.
  if (!blob.type || blob.type === 'application/octet-stream') {
    const head = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () =>
        reject(new Error('Could not read the image data.'));
      reader.readAsArrayBuffer(blob.slice(0, 32));
    });
    const text = (start: number, end: number) =>
      String.fromCharCode(...head.slice(start, end));
    let type: string | undefined;
    if (
      [137, 80, 78, 71, 13, 10, 26, 10].every(
        (byte, index) => head[index] === byte
      )
    )
      type = 'image/png';
    else if (head[0] === 255 && head[1] === 216 && head[2] === 255)
      type = 'image/jpeg';
    else if (['GIF87a', 'GIF89a'].includes(text(0, 6))) type = 'image/gif';
    else if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP')
      type = 'image/webp';
    else if (text(4, 8) === 'ftyp' && ['avif', 'avis'].includes(text(8, 12)))
      type = 'image/avif';
    else if (text(0, 2) === 'BM') type = 'image/bmp';
    if (type) blob = new Blob([blob], { type });
  }
  if (!blob.type.startsWith('image/'))
    throw new Error('An image could not be exported.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('An image could not be exported.'));
    reader.readAsDataURL(blob);
  });
};

const imageData = async (source: string) => {
  const url = new URL(source, window.location.href);
  if (!['http:', 'https:', 'blob:', 'data:'].includes(url.protocol))
    throw new Error('An image could not be exported.');
  const response = await fetch(url.href, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error('Load the page images and try exporting again.');
  return blobImageData(await response.blob());
};

// Node metadata may still be arriving when export opens. Wait for those file
// blocks, rather than silently omitting an image whose DOM preview is absent.
const waitForFiles = (source: HTMLElement) =>
  new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(check);
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            'Some page files are still loading. Please try exporting again.'
          )
        ),
      15000
    );
    function finish(error?: Error) {
      clearTimeout(timer);
      observer.disconnect();
      if (error) reject(error);
      else resolve();
    }
    function check() {
      if (source.querySelector('[data-export-file-unavailable]'))
        finish(
          new Error(
            'A referenced page file is unavailable. Please check its access and try again.'
          )
        );
      else if (!source.querySelector('[data-export-file-loading]')) finish();
    }
    observer.observe(source, {
      childList: true,
      attributes: true,
      subtree: true,
    });
    check();
  });

export const buildPageExport = async (
  source: HTMLElement,
  title: string,
  options?: {
    resolveImage: (id: string) => Promise<Blob>;
  }
) => {
  await waitForFiles(source);
  const output = document.implementation.createHTMLDocument(title);
  // Keep light/dark text readable without depending on the app's theme variables.
  output.body.style.color = getComputedStyle(source).color;
  for (
    let parent: HTMLElement | null = source;
    parent;
    parent = parent.parentElement
  ) {
    const background = getComputedStyle(parent).backgroundColor;
    if (
      background &&
      background !== 'transparent' &&
      background !== 'rgba(0, 0, 0, 0)'
    ) {
      output.body.style.backgroundColor = background;
      break;
    }
  }
  const cache = new Map<string, Promise<string>>();
  const clone = async (node: Node): Promise<Node | null> => {
    if (node.nodeType === Node.TEXT_NODE)
      return output.createTextNode(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return null;
    if (
      node.matches(
        '[data-export-exclude], [aria-label="Page title"], script, style, iframe, object, embed, button, select, textarea, [role="button"], [role="menu"], [role="status"]'
      )
    )
      return null;
    const imageId = node.dataset.exportImageId;
    if (imageId) {
      const key = `file:${imageId}`;
      if (!cache.has(key)) {
        const resolve = () => {
          if (!options?.resolveImage)
            throw new Error('A page image could not be loaded for export.');
          return options.resolveImage(imageId).then(blobImageData);
        };
        const existing = node.querySelector<HTMLImageElement>('img');
        const src = existing?.currentSrc || existing?.src;
        cache.set(key, src ? imageData(src).catch(resolve) : resolve());
      }
      const figure = output.createElement('figure');
      figure.id = `block-${imageId}`;
      const image = output.createElement('img');
      image.src = await cache.get(key)!;
      image.alt = node.dataset.exportImageName ?? 'Page image';
      figure.appendChild(image);
      return figure;
    }
    if (node instanceof HTMLInputElement) {
      if (node.type === 'checkbox')
        return output.createTextNode(node.checked ? '☑ ' : '☐ ');
      return output.createTextNode(node.value);
    }
    const name = node.tagName.toLowerCase();
    const tag = tags.has(name) ? name : nodeViewTags.get(name);
    if (!tag) {
      if (node.querySelector('[data-export-image-id],img'))
        throw new Error(
          'An image is inside a page block that cannot be exported yet.'
        );
      return null;
    }
    const element = output.createElement(tag);
    const computed = getComputedStyle(node);
    for (const property of styles) {
      const value = computed.getPropertyValue(property);
      if (value && !(property === 'display' && value === 'none'))
        element.style.setProperty(property, value);
    }
    const id = node.dataset.id ?? node.dataset.documentBlock;
    if (id) element.id = `block-${id}`;
    if (element instanceof HTMLDetailsElement) element.open = true;
    for (const attribute of ['colspan', 'rowspan', 'start', 'dir', 'lang']) {
      const value = node.getAttribute(attribute);
      if (value) element.setAttribute(attribute, value);
    }
    if (node instanceof HTMLAnchorElement) {
      const href = safeLink(node.getAttribute('href') ?? '');
      if (href) element.setAttribute('href', href);
    }
    if (node instanceof HTMLImageElement) {
      const src = node.currentSrc || node.src;
      if (!src)
        throw new Error('Load the page images and try exporting again.');
      if (!cache.has(src)) cache.set(src, imageData(src));
      element.setAttribute('src', await cache.get(src)!);
      element.setAttribute('alt', node.alt);
    }
    // Preserve order while image conversion is asynchronous.
    for (const child of Array.from(node.childNodes)) {
      const result = await clone(child);
      if (result) element.appendChild(result);
    }
    return element;
  };
  const charset = output.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const csp = output.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
  output.head.prepend(charset, csp);
  const style = output.createElement('style');
  style.textContent =
    'body{font-family:system-ui,sans-serif;color:#222;background:white;max-width:1100px;margin:32px auto;padding:0 24px;overflow-wrap:anywhere}*{box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact}img,table{max-width:100%;height:auto}figure{margin:12px 0}figure img{display:block;max-width:100%;height:auto}pre{white-space:pre-wrap}a{color:#1859a9}details>summary{cursor:default}h1{font-size:2em}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}@page{size:A4;margin:15mm}@media print{body{max-width:none;margin:0;padding:0}h1,h2,h3{break-after:avoid}img,tr,figure{break-inside:avoid}figure img{max-height:240mm;object-fit:contain}}';
  output.head.appendChild(style);
  const heading = output.createElement('h1');
  heading.textContent = title;
  output.body.appendChild(heading);
  const body = await clone(source);
  if (body) output.body.appendChild(body);
  return '<!doctype html>\n' + output.documentElement.outerHTML;
};

export const downloadPageHtml = (html: string, title: string) => {
  const url = URL.createObjectURL(
    new Blob([html], { type: 'text/html;charset=utf-8' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download =
    (Array.from(title, (character) =>
      character.charCodeAt(0) < 32 ? '_' : character
    )
      .join('')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim() || 'page') + '.html';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
