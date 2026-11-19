# Page export

Open the **settings gear → Export page** on a page, database view, record, or
shared page. There is no separate export button above the body.
Choose **Download HTML** for a standalone HTML file. For PDF, choose **PDF preview**,
then **Print / Save as PDF**, and select the browser's Save as PDF destination.
The export preview contains the document, without the app sidebar or editing controls.

The first version exports the current page's displayed content. Child pages remain
links. Database exports contain the rows currently displayed by the selected view,
not all records or every view. Open/load the desired database rows before export. Body images are included even
when their previews have not been loaded or are outside the viewport.
Video/audio/file binaries are not bundled; their displayed names/links are retained
where present. This is a viewing snapshot, not a restorable workspace backup.

Both HTML and PDF embed original page images, reusing loaded originals or fetching
referenced images through the current reader’s existing authenticated download.
Images are placed in their body positions and fitted onto the PDF page without
clipping to the editor preview size. The export also includes formatting/background colors, tables, lists,
and expanded toggle contents. Image conversion failures are reported instead of
silently downloading a broken image URL. Export does not fetch child pages, extra
records, or unreferenced attachments. It preserves only safe document markup and
static styles, without editor scripts, event handlers, or account credentials.
Source-page links continue to require the reader's normal access.

Reading access is sufficient to export displayed content. Background formatting
still requires editing rights. Block handles and their action popovers stay inside
an open record modal so the modal's focus/pointer restrictions do not block them.

Editable editor NodeViews (including file-image blocks) are retained as static
HTML containers. PNG, JPEG, GIF, WebP, AVIF, and BMP byte signatures are recognized
when storage omits the image response Content-Type; untyped non-image responses
are rejected. Unsupported containers holding images report an error rather than
silently dropping their contents.

## Notion ZIP

Choose **settings gear → Export page → Notion ZIP** to download one page's
HTML and referenced original body images in a single ZIP. In Notion use
**Settings → Import → ZIP** (Convert ZIP to pages), then select the downloaded
ZIP without extracting it. The archive contains `notion-export/<title>.html`
and `notion-export/assets/image-001.png` (or the image's matching extension).
Image paths are relative, so images do not require a Colanode login after import.
Repeated identical image content is bundled once. No account tokens, temporary
image URLs, unreferenced attachments, or unrelated pages are included.

This first step covers one page's body and images. Child pages remain original
Colanode links; displayed tables are static HTML tables, not imported Notion
databases. Notion may simplify colors, toggles, and layout. Import is a copy,
not synchronization; permissions and edit history do not transfer.

Next milestones requested by the user are **both** recursive child-page import
(hierarchy, packaged assets, and internal-link rewriting) and database import
(records, properties and record bodies, with explicit handling of unsupported
relations/formulas). These are not part of the one-page ZIP. Do not recursively
export pages or records without checking the exporting reader's existing access.

Reference: https://www.notion.com/help/import-data-into-notion
