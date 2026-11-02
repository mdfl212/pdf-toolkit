# PDF Toolkit · StudyMats

**Browser-based PDF toolkit centered on textbook Chapter Extraction** — with compression, merging, page editing, batch processing, and other everyday PDF tools for study and document workflows.

**Live demo:** https://mdfl212.github.io/pdf-toolkit/

Part of [StudyMats](https://mdfl212.github.io/mdfl212.studymats.io/) by [mdfl212](https://github.com/mdfl212).

---

## Why this exists

Many textbooks already have a built-in outline (bookmarks): Chapter 1, Chapter 2, Appendix, and so on.  
This tool reads those bookmarks in your browser, calculates each chapter’s page range, and exports separate PDFs — so you can upload **only the chapters on your syllabus** into NotebookLM instead of a 1,000-page file.

It replaces a common **PDFtk Server** command-line workflow (look up bookmark pages → write `pdftk input.pdf cat 10-31 output chapter.pdf`) with a point-and-click UI.  
**This is not PDFtk, not a rebrand of PDFtk, and not affiliated with PDF Labs.** It is an independent browser app inspired by that workflow.

---

## Acknowledgments

**Thanks to the original developers of PDFtk — the PDF Toolkit**  
https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/

[PDFtk](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/) (PDF Labs) popularized reliable command-line PDF assembly, splitting, and page-range extraction. This project does **not** use PDFtk’s code, binaries, or trademarks. It reimplements a *bookmark → page range → extract* study workflow in pure JavaScript (PDF.js + pdf-lib + JSZip) so it can run offline in the browser with no install.

If you need the full power of the classic toolkit (forms, encryption, repair, etc.), use **[PDFtk from PDF Labs](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/)**.

---

## Step-by-step: extract chapters for NotebookLM

### 1. Open the app
Go to **https://mdfl212.github.io/pdf-toolkit/**  
(or open `pdf-toolkit.html` locally).

### 2. Drop your textbook PDF
On **Chapter Extractor**, drop a PDF that has an outline/bookmarks  
(most publisher textbooks and many lecture compilations do).

### 3. Review the bookmark tree
- Titles and starting pages appear in the list.
- Use **Extraction mode** if needed:
  - **Auto** — tries to pick a sensible “chapter” depth
  - **Depth 0 / 1 / 2** — top-level vs nested sections
  - **Manual** — only what you check
- Search/filter by title if the outline is long.

### 4. Check page ranges
The preview table shows **Start**, **End**, and **page count** for each selected item.

- Ranges follow the **bookmark hierarchy** (a chapter runs until the next chapter-level bookmark).
- Edit Start/End if a range looks wrong; use **↺** to restore the calculated values.
- Rows marked **Review** may share a start page or need a quick human check.

### 5. Extract
Click **Extract selected chapters**.

- Each chapter becomes its own PDF (searchable text preserved when the source allows).
- Download files one by one, or **Download all as ZIP**.

### 6. Upload to NotebookLM
1. Open [NotebookLM](https://notebooklm.google.com/).
2. Create or open a notebook for the course.
3. Upload **only the chapter PDFs** that match your syllabus (not the whole textbook).
4. Ask questions, generate guides, or quiz from those sources.

Smaller, syllabus-scoped sources usually work better than one giant book file.

---

## Tools in the app

The app opens to a **document workspace** with smart local file detection, common tasks, recently used tools, favorites, and search. Drop or select a document to identify its format from its content and file signature. Verified PDFs open directly in the existing PDF workspace; recognized image, Word, text, and Office formats are identified and routed to the conversion workflows that are currently available. Images can now be combined into a PDF or PDF pages exported as images. DOCX, XLSX, PPTX, ODT, RTF, HTML, and TXT files can be rendered locally and sent to the browser's native Print / Save as PDF workflow; legacy binary DOC remains outside this batch. Upload a PDF once from the workspace homepage: its preview and source file remain available while you switch tools, and supported tools preload that active document automatically. Use **Change PDF** to replace the working document. The source remains in the browser for the current session; each editing tool works from its own PDF instance so one tool's changes do not silently overwrite the shared source. Use the category navigation to find a task; the Chapter Extractor remains available for bookmark-based textbook splitting. Existing tools keep their browser-based processing flows.

| Category | Tools |
|----------|-------|
| **Split & Extract** | Chapter Extractor; Split / Extract Pages; Extract Text |
| **Merge & Organize** | Merge PDFs; Reorder Pages; Rotate Pages; Delete Pages; Bookmark Manager; Remove Blank Pages |
| **OCR & Searchability** | OCR & Searchable PDF |
| **Compress & Optimize** | Compress PDF |
| **Protect & Manage** | Password Protect; Watermark |
| **Inspect & Analyze** | PDF Metadata; Smart Document Assistant; Repair PDF |
| **Advanced Tools** | Word (DOCX) to PDF; PDF to editable DOCX; Images to PDF; PDF to Images; Batch Processor; Extract Figures |

Pin frequently used tools with the star on a tool card. Search covers tool names and descriptions; recent tools and favorites are saved in this browser.

### Image conversion notes

- **Images to PDF** combines multiple images into one PDF, with one image per page. Review thumbnails, move images up or down, remove unwanted files, and choose A4, US Letter, or a page fitted to each image.
- JPEG and PNG files are embedded directly. Other recognized image formats are decoded by the browser and converted to PNG before being embedded; HEIC/HEIF and TIFF decoding depends on browser support.
- **PDF to Images** exports selected pages as PNG or JPEG, with standard/high/very high/maximum resolution choices. It previews and offers individual downloads for the first 24 selected pages; the ZIP contains every selected page.
- Both directions run locally in the browser. Large images, high resolutions, or very long PDFs can consume substantial memory. The original files are not modified.

### Work-in-progress tools (Batches 3–6)

The following conversion and analysis tools are currently **WIP / troubleshooting only**. They are present in the interface, but their behavior has not yet been validated as reliable. Do not treat them as production-ready; verify outputs against the source document and report problems before relying on them.

| Batch | Tool | Current status |
|---|---|---|
| 3 | Word (DOCX) to PDF | WIP — troubleshooting required |
| 4 | PDF to editable DOCX | WIP — troubleshooting required |
| 5 | Additional formats to PDF (XLSX, PPTX, ODT, RTF, HTML, TXT) | WIP — troubleshooting required |
| 6 | Smart Document Assistant | WIP — troubleshooting required |

These labels are status warnings only. The tools remain accessible so they can be tested and troubleshot. Earlier tools, including the Batch 2 image ↔ PDF workflows, are not included in this WIP designation.

### Word (DOCX) to PDF notes

- **Word (DOCX) to PDF** uses docx-preview to render a DOCX document in the browser, then opens the browser's native print dialog. Choose **Save as PDF** to create the PDF. The resulting PDF retains selectable/searchable text because the browser prints rendered HTML text rather than rasterizing every page.
- The document is processed locally; it is not uploaded to a conversion server. The DOCX renderer is loaded from a pinned CDN version and is cached by the service worker after it has been fetched once.
- DOCX layout is not guaranteed to match Microsoft Word exactly. Pagination, fonts, floating objects, advanced tables, tracked changes, and unsupported Word features can differ. Review the preview and the saved PDF.
- The browser controls the final Save as PDF action; the app cannot silently create a file from the native print dialog. Legacy .doc files are not supported by this batch.

### Additional formats to PDF notes

- **XLSX**: each worksheet is rendered as a printable table using cached cell values. Formulas are not recalculated, and charts, drawings, macros, and exact Excel print settings are not preserved. Workbooks larger than 250,000 printable cells are rejected to protect browser memory.
- **PPTX**: slides are rendered locally to SVG for the print preview. Animations and transitions are static; advanced effects, embedded media, SmartArt, and uncommon fonts may differ from PowerPoint. Presentations over 200 slides are rejected to protect browser memory.
- **ODT**: the converter reconstructs paragraphs, headings, lists, and basic tables from the OpenDocument XML package. Images, charts, tracked changes, and advanced styles may be omitted.
- **RTF**: supported rich-text formatting is rendered with rtf.js. Some embedded image formats and uncommon RTF controls may not be reproduced.
- **HTML**: active content is removed before preview and printing. Scripts, forms, embedded frames, remote images, external stylesheets, and inline styles are not included.
- **TXT**: UTF-8 and UTF-16 text is rendered with line breaks preserved.
- All six workflows run in the browser. Review the preview and choose **Print / Save as PDF** in the browser's print dialog. This is a browser-rendered PDF, not a byte-for-byte conversion by Microsoft Office or LibreOffice. Page layout can vary by browser and device.

### PDF to editable DOCX notes

- **PDF to editable DOCX** extracts the PDF's selectable text with PDF.js and rebuilds it as editable Word paragraphs using the browser build of the `docx` library.
- Text is grouped into visual lines using PDF coordinates; font size, basic bold/italic hints, approximate headings, page breaks, and page dimensions are carried over where possible.
- This is a reconstruction, not recovery of the original Word source. Multi-column reading order, complex tables, equations, charts, images, floating objects, and exact typography may not survive. Images are not embedded in this first batch.
- Scanned/image-only PDFs need a text layer first. Run **OCR & Searchable PDF**, save the OCR output, then convert that searchable PDF. Pages with no text are reported and marked; a file with no selectable text is rejected rather than producing an empty DOCX.
- Password-protected PDFs must be unlocked and saved before conversion. Processing and DOCX generation run locally in the browser; the PDF is not uploaded.

### Smart Document Assistant notes

- **Smart Document Assistant** analyzes the active PDF locally with PDF.js. It extracts selectable text page by page, reads embedded PDF bookmarks when present, and reports pages without selectable text.
- The overview is an **extractive summary**: it selects sentences from the source and includes page references. Key topics are frequency-based terms, and study prompts are generic review questions generated from those terms.
- **Ask this document** ranks matching source sentences and displays quoted evidence with PDF page numbers. It does not generate free-form answers; if it cannot find matching evidence, it says so. Verify the cited page in the original document.
- Scanned pages need a text layer. Run **OCR & Searchable PDF**, save the searchable result, and analyze that PDF. Partial-text documents are analyzed with a warning for pages that lack text.
- No document content is sent to an AI service or remote API. The PDF is not saved to browser storage by the assistant. Analysis is temporary for the current page session and can be exported as Markdown notes.
- Text extraction order can be imperfect in multi-column pages, tables, equations, and complex layouts. This tool is a study aid, not a substitute for checking the source.

### OCR notes

- **OCR & Searchable PDF** uses Tesseract.js in the browser to recognize English text on selected pages or page ranges and adds a transparent text layer over the original pages.
- Pages that already contain a usable selectable text layer are skipped to reduce duplicate text. OCR output must be reviewed; scan quality, skew, small print, tables, and handwriting can reduce accuracy.
- OCR rendering is capped at approximately 18 million pixels per page to reduce browser memory failures on unusually large pages. When the cap applies, the effective resolution may be lower than the selected scale.
- Automatic page segmentation is a best-effort recognition mode, not reliable table reconstruction. Numeric tables and multi-column pages should be checked visually against the original; the current tool creates a searchable text layer and does not rebuild editable table cells.
- Use **Prepare OCR for offline use** while online to cache the OCR engine and English language data. This can download tens of megabytes. Offline readiness must be verified by reopening the app without internet and testing OCR; browser storage can be cleared or evicted.
- The tool runs locally and does not upload the PDF. The initial implementation focuses on searchable text, not full preservation of every advanced PDF feature.

### Compression notes

- **Basic optimization** re-saves the PDF and keeps text selectable where supported, but size reduction varies and may be small.
- **Stronger compression** converts pages to JPEG-backed images. This can reduce image-heavy PDFs more, but the result loses selectable/searchable text and may lose links, bookmarks, forms, and accessibility features.

Smart file detection and existing PDF processing run **in your browser**. File detection checks content signatures and document package structure rather than trusting the filename extension alone. Non-PDF conversion routes are introduced progressively; a detected format is not advertised as convertible until its conversion engine is implemented and tested. Files are not uploaded to a server.

---

## Tips

- Prefer PDFs with a real outline (Bookmarks panel in a desktop reader).
- Page numbers here are **PDF page indices** (1 = first page of the file), not always the printed page number in the book.
- Very large books: extract in batches if the browser runs low on memory.
- For full PDFtk-style automation on a server or PC, use [PDFtk Server](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/) from PDF Labs.

---

## Local / offline

```bash
# optional local server (helps PWA install)
npx serve .
```

Or double-click `pdf-toolkit.html`.  
Install as an app (PWA) when served over HTTPS for offline use of cached libraries.

---

## Related StudyMats tools

- [StudyMats Question Bank](https://mdfl212.github.io/mdfl212.studymats.io/)
- [MedTrans — lecture to Word reviewer](https://github.com/mdfl212/MedTrans-GitHub-Repo)

---

## Disclaimer

- Not affiliated with PDF Labs, PDFtk, Google, or NotebookLM.
- Respect copyright and your institution’s rules when splitting and uploading textbooks.
- Provided as-is for personal study workflows.


### Smart file detection tests

Run the browser utility unit tests with Node.js:

```bash
node --experimental-default-type=module --test tests/*.test.mjs
```
