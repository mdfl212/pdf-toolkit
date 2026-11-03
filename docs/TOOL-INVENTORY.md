# PDF Toolkit tool inventory

**Audit basis:** `main` source reviewed 2026-11-03. This records registered tools and code entry points; it is not a certification that every feature has passed end-to-end QA.

## Summary

- **23 tools** in **7 categories**.
- **5 tools are explicitly marked WIP / troubleshooting**: OCR, Smart Document Assistant, DOCX to PDF, Additional formats to PDF, and PDF to editable DOCX.
- The category-based hybrid workspace already exists: category navigation, tool search, Common Tasks, favorites, recent tools, tool cards, and a shared active-PDF workspace.
- The catalog is declared in `toolCatalog` in `pdf-toolkit.html`. Some tool panels are injected by separately loaded JavaScript modules.

## Complete tool catalog

| Category | Tool | Registry ID | Implementation entry point | Status / notes |
|---|---|---|---|---|
| Split & Extract | Chapter Extractor | `chapters` | `pdf-toolkit.html` | Bookmark-based chapter extraction |
| Split & Extract | Split / Extract Pages | `split` | `pdf-toolkit.html` | Page ranges and individual-page splitting |
| Split & Extract | Extract Text | `text-extract` | `text-extract.js` | Extracts existing selectable text; does not OCR scans |
| Merge & Organize | Merge PDFs | `merge` | `pdf-toolkit.html` | Combines PDFs |
| Merge & Organize | Reorder Pages | `reorder` | `pdf-toolkit.html` | Reorders pages |
| Merge & Organize | Rotate Pages | `rotate` | `pdf-toolkit.html` | Rotates selected pages or the document |
| Merge & Organize | Delete Pages | `delete` | `pdf-toolkit.html` | Removes selected pages |
| Merge & Organize | Bookmark Manager | `bookmarks` | `pdf-toolkit.html` | Inspects and edits the PDF outline |
| Merge & Organize | Remove Blank Pages | `blank-pages` | `blank-pages.js` | Detects and removes blank pages |
| OCR & Searchability | OCR & Searchable PDF | `ocr` | `ocr.js` | **WIP** — recognition accuracy and edge cases need validation |
| Compress & Optimize | Compress PDF | `compress` | `pdf-toolkit.html` | Basic optimization and stronger image-based compression; stronger mode may rasterize pages and lose text/features |
| Protect & Manage | Watermark | `watermark` | `pdf-toolkit.html` | Applies text watermark |
| Protect & Manage | Password Protect | `security` | `security.js` | Password protection workflow |
| Inspect & Analyze | PDF Metadata | `metadata` | `pdf-toolkit.html` | Views document properties |
| Inspect & Analyze | Smart Document Assistant | `assistant` | `smart-document-assistant.js` + panel in `pdf-toolkit.html` | **WIP** — local extractive summary and source-sentence evidence, not generative AI |
| Inspect & Analyze | Repair PDF | `repair` | `pdf-toolkit.html` | Attempts structural repair/rewrite of recoverable PDFs |
| Advanced Tools | Extract Figures | `figure-images` | `figure-images.js` | Extracts images/figures from PDF pages |
| Advanced Tools | Word (DOCX) to PDF | `docx-pdf` | `docx-to-pdf.js` | **WIP** — browser rendering and native Print/Save as PDF, not Word/LibreOffice-grade rendering |
| Advanced Tools | Additional formats to PDF | `additional-formats` | `additional-formats-to-pdf.js` | **WIP** — XLSX, PPTX, ODT, RTF, HTML, and TXT browser-rendering workflows |
| Advanced Tools | PDF to editable DOCX | `pdf-docx` | `pdf-to-docx.js` | **WIP** — reconstructs editable paragraphs; does not recover original DOCX layout |
| Advanced Tools | Images to PDF | `image-pdf` | `image-to-pdf.js` | Combines images into a PDF |
| Advanced Tools | PDF to Images | `pdf-images` | `pdf-to-images.js` | Exports PDF pages as PNG/JPEG |
| Advanced Tools | Batch Processor | `batch` | `pdf-toolkit.html` | Runs supported operations in a batch workflow |

## Category counts

| Category | Count |
|---|---:|
| Split & Extract | 3 |
| Merge & Organize | 6 |
| OCR & Searchability | 1 |
| Compress & Optimize | 1 |
| Protect & Manage | 2 |
| Inspect & Analyze | 3 |
| Advanced Tools | 7 |
| **Total** | **23** |

## Existing discovery/navigation features

The current workspace already implements:
- Seven categories in `toolCategories`, with desktop and mobile category navigation.
- A central `toolCatalog` containing the 23 entries above.
- Search across tool names, descriptions, and category names.
- Common Tasks shortcuts (currently Chapter Extractor, OCR, Compress, and Merge).
- Favorites and a five-item recent-tools list saved in browser local storage.
- Category counts and descriptive tool cards.
- A shared active-PDF workspace for compatible tools.

**Conclusion:** Do not rebuild the navigation from scratch. Refine and validate the existing hybrid workspace.

## Category mapping and distinctions

- **Extract Text** reads text already present in a PDF text layer; **OCR** recognizes text from scanned/image-only pages. These are complementary.
- **Chapter Extractor** derives chapter ranges from existing bookmarks; **Bookmark Manager** inspects and edits the outline.
- **Repair PDF** stays under **Inspect & Analyze** as a diagnostic/recovery workflow.
- **Extract Figures** stays under **Advanced Tools** because it extracts visual assets rather than reorganizing pages.
- Format conversions and Batch Processor stay under **Advanced Tools**.

## Proposed functions not currently represented as standalone catalog tools

The earlier category proposal mentioned these, but there is no dedicated catalog entry in the audited source. Do not advertise them as available until implemented and tested:

- Insert pages from another PDF or create/insert blank pages.
- Linearize / Fast Web View optimization.
- Flatten forms or annotations.
- Remove arbitrary unused PDF objects.
- Dedicated batch compression.
- Standalone metadata removal.
- A distinct PDF structural-validation report beyond existing metadata/repair workflows.

Related functionality may be achievable indirectly; this list means there is no dedicated standalone tool entry confirmed by the catalog.

## Audit findings and recommended follow-up

1. **Consolidate tool metadata.** The central catalog is in `pdf-toolkit.html`, while several modules independently inject sidebar buttons and panels. Gradually move ID, category, title, description, icon, readiness, and entry point into one registry contract. Preserve existing panel IDs and processing functions during migration.
2. **Centralize panel navigation.** Some modules attach their own click handlers and manually toggle active panels, while the main page also has `showPanel()`. Route launches through one central panel activation contract/event to avoid inconsistent state and recent-tool tracking.
3. **Keep readiness labels evidence-based.** Retain the five WIP labels until each tool passes documented tests with representative files. Accessibility is not proof of production readiness.
4. **Add registry/navigation tests.** Assert unique catalog IDs, valid categories, required descriptions/status values, resolvable static or module-created panels, matching category counts, recent-use tracking, and shared active-PDF handoff. Then run desktop/mobile browser smoke tests for all 23 tools.

## Recommended sequence

1. Preserve the existing seven categories and 23 IDs.
2. Add catalog and panel-registration consistency tests.
3. Centralize panel activation and recent-tool tracking.
4. Improve category descriptions and Common Tasks based on real workflows.
5. Validate the five WIP tools with representative documents before changing their status.
6. Only then consider adding the proposed standalone tools above.

## Scope and limitations

“Listed without WIP label” means only that the catalog does not mark the tool WIP. It is not a guarantee of comprehensive regression, security, or cross-browser validation. This audit reviewed the catalog, source entry points, navigation handlers, and README notes; it did not execute every tool against a test corpus.
