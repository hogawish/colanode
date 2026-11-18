# Page export

Use **Export page** above a page, database view, record body, or shared page.
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
