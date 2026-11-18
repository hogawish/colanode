// Export only the content already visible to the current reader. No traversal
// of child pages or requests for additional database records or private files.
const tags = new Set(
  'a article b blockquote br code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img label li ol p pre s section span strong sub summary sup table tbody td th thead tr u ul'.split(
    ' '
  )
);
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
const imageData = async (source: string) => {
  const url = new URL(source, window.location.href);
  if (!['http:', 'https:', 'blob:', 'data:'].includes(url.protocol))
    throw new Error('An image could not be exported.');
  const response = await fetch(url.href, { credentials: 'same-origin' });
  if (!response.ok)
    throw new Error('Load the page images and try exporting again.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/'))
    throw new Error('An image could not be exported.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('An image could not be exported.'));
    reader.readAsDataURL(blob);
  });
};

export const buildPageExport = async (source: HTMLElement, title: string) => {
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
    if (node instanceof HTMLInputElement) {
      if (node.type === 'checkbox')
        return output.createTextNode(node.checked ? '☑ ' : '☐ ');
      return output.createTextNode(node.value);
    }
    if (!tags.has(node.tagName.toLowerCase())) return null;
    const element = output.createElement(node.tagName.toLowerCase());
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
    'body{font-family:system-ui,sans-serif;color:#222;background:white;max-width:1100px;margin:32px auto;padding:0 24px;overflow-wrap:anywhere}*{box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact}img,table{max-width:100%;height:auto}pre{white-space:pre-wrap}a{color:#1859a9}details>summary{cursor:default}h1{font-size:2em}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}@page{size:A4;margin:15mm}@media print{body{max-width:none;margin:0;padding:0}h1,h2,h3{break-after:avoid}img,tr{break-inside:avoid}}';
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
