# PDF Toolkit — Tool Inventory Audit

**Audit basis:** `main` branch, reviewed 2026-11-03  
**Application entry point:** `pdf-toolkit.html`  
**Purpose:** Record the tools actually registered in the workspace, their current categories, implementation files, and readiness labels. This is an inventory, not a claim that every feature has passed end-to-end QA.

## Summary

- **23 registered tools**
- **7 functional categories**
- **5 tools explicitly marked WIP / troubleshooting**
- The current application already has category navigation, a searchable catalog, Common Tasks, favorites, recent tools, and responsive category navigation.
- The catalog is maintained in the `toolCatalog` array in `pdf-toolkit.html`. Several tool panels are injected at runtime by standalone JavaScript modules.

## Complete tool inventory

| Category | Tool | Catalog ID | Implementation entry point | Catalog status | Notes |
|---|---|---|---|---|---|
| Split & Extract | Chapter Extractor | `chapters` | `pdf-toolkit.html` | Listed without WIP label | Bookmark-based chapter/page-range extraction workflow. |
| Split & Extract | Split / Extract Pages | `split` | `pdf-toolkit.html` | Listed without WIP label | Extract page ranges or split into individual pages. |
| Split & Extract | Extract Text | `text-extract` | `text-extract.js` | Listed without WIP label | Extracts selectable PDF text; distinct from OCR of image-only pages. |
| Merge & Organize | Merge PDFs | `merge` | `pdf-toolkit.html` | Listed without WIP label | Combines PDFs. |
| Merge & Organize | Reorder Pages | `reorder` | `pdf-toolkit.html` | Listed without WIP label | Reorders pages. |
| Merge & Organize | Rotate Pages | `rotate` | `pdf-toolkit.html` | Listed without WIP label | Rotates selected pages or the document. |
| Merge & Organize | Delete Pages | `delete` | `pdf-toolkit.html` | Listed without WIP label | Removes selected pages. |
| Merge & Organize | Bookmark Manager | `bookmarks` | `pdf-toolkit.html` | Listed without WIP label | Inspects and edits the PDF outline/bookmarks. |
| Merge & Organize | Remove Blank Pages | `blank-pages` | `blank-pages.js` | Listed without WIP label | Detects and removes blank pages. |
| OCR & Searchability | OCR & Searchable PDF | `ocr` | `ocr.js` | **WIP** | Recognition quality and edge cases require further validation. |
| Compress & Optimize | Compress PDF | `compress` | `pdf-toolkit.html` | Listed without WIP label | Offers basic optimization and stronger image-based compression; stronger mode can rasterize pages and lose selectable text/features. |
| Protect & Manage | Watermark | `watermark` | `pdf-toolkit.html` | Listed without WIP label | Applies a text watermark. |
| Protect & Manage | Password Protect | `security` | `security.js` | Listed without WIP label | Password protection workflow. |
| Inspect & Analyze | PDF Metadata | `metadata` | `pdf-toolkit.html` | Listed without WIP label | Views document information and properties. |
| Inspect & Analyze | Smart Document Assistant | `assistant` | `smart-document-assistant.js` + panel in `pdf-toolkit.html` | **WIP** | Extractive summary, topic/outline exploration, and source-sentence evidence; not a generative AI answer engine. |
| Inspect & Analyze | Repair PDF | `repair` | `pdf-toolkit.html` | Listed without WIP label | Attempts structural repair/rewrite of recoverable PDFs. |
| Advanced Tools | Extract Figures | `figure-images` | `figure-images.js` | Listed without WIP label | Extracts images/figures from PDF pages. |
| Advanced Tools | Word (DOCX) to PDF | `docx-pdf` | `docx-to-pdf.js` | **WIP** | Browser preview + native Print/Save as PDF; not Word/LibreOffice-grade rendering. |
| Advanced Tools | Additional formats to PDF | `additional-formats` | `additional-formats-to-pdf.js` | **WIP** | XLSX, PPTX, ODT, RTF, HTML, and TXT browser-rendering workflows. |
| Advanced Tools | PDF to editable DOCX | `pdf-docx` | `pdf-to-docx.js` | **WIP** | Reconstructs editable paragraphs from selectable PDF text; does not recover original DOCX layout. |
| Advanced Tools | Images to PDF | `image-pdf` | `image-to-pdf.js` | Listed without WIP label | Combines images into a PDF. |
| Advanced Tools | PDF to Images | `pdf-images` | `pdf-to-images.js` | Listed without WIP label | Exports PDF pages as PNG/JPEG. |
| Advanced Tools | Batch Processor | `batch` | `pdf-toolkit.html` | Listed without WIP label | Runs supported operations in a batch workflow. |

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

## Navigation and discovery features already present

The current workspace in `pdf-toolkit.html` already implements:

- Seven category definitions in `toolCategories`.
- A central `toolCatalog` containing all 23 entries.
- Desktop category navigation and mobile category navigation.
- Tool search across tool names, descriptions, and category names.
- Common Tasks shortcuts (currently Chapter Extractor, OCR, Compress, and Merge).
- Favorites stored in browser local storage.
- A five-item recent-tools list stored in browser local storage.
- Category tool counts and per-tool cards.
- A shared PDF workspace that keeps an active PDF available while switching between compatible tools.

**Conclusion:** The next UI work should refine and validate this existing system rather than replace it with a second navigation architecture.

## Audit findings and follow-up actions

### 1. Keep one catalog as the source of truth

The catalog and categories currently live in `pdf-toolkit.html`, while many modules independently inject their own hidden sidebar buttons and panels. This works as a legacy integration pattern, but it creates two sources of navigation metadata: the central catalog and module-created buttons.

**Recommended action:** Gradually move tool metadata (ID, category, title, description, icon, readiness, and entry point) into a single registry contract. Keep the current HTML IDs and processing functions stable during the migration.

### 2. Centralize panel navigation

Several injected modules attach their own click handlers and manually toggle active panels. The main page also has a central `showPanel()` function. This split can lead to inconsistent navigation state, recent-tool tracking, keyboard behavior, or active-document handoff.

**Recommended action:** Introduce a central `openTool(id)` / panel activation event that every module uses. Do not change PDF processing logic as part of that refactor.

### 3. Treat readiness as explicit metadata

The catalog currently labels five entries WIP: OCR, Smart Document Assistant, DOCX to PDF, Additional formats to PDF, and PDF to editable DOCX. README notes also warn that these workflows require output verification.

**Recommended action:** Keep the warning visible on cards and in tool panels until each tool passes documented test cases. Do not infer production readiness merely because a tool is accessible.

### 4. Clarify overlapping functions

- **Extract Text** is for text already present in a PDF text layer; **OCR** creates a text layer from scanned/image-only pages.
- **Chapter Extractor** uses existing bookmarks to derive chapter ranges; **Bookmark Manager** edits or inspects the outline.
- **Repair PDF** is currently grouped under Inspect & Analyze. This is acceptable for discoverability, although it is also an operational/recovery action.
- **Compress PDF** offers modes with different trade-offs. The UI should clearly disclose when a mode rasterizes pages and can remove selectable/searchable text or interactive features.

These are complementary tools rather than confirmed duplicates.

### 5. Complete the automated navigation checks

The existing README documents a Node test command for the smart file-detection tests. The repository does not currently document a test that asserts every catalog entry has a matching panel/module registration, a valid category, and a functioning navigation route.

**Recommended action:** Add a lightweight registry consistency test and browser smoke checks before changing the navigation architecture.

## Recommended implementation sequence

1. Preserve the existing seven categories and 23 tool IDs.
2. Add automated checks for catalog/category consistency and panel registration.
3. Centralize panel activation and recent-tool tracking.
4. Refine category descriptions and Common Tasks based on actual user workflows.
5. Review every WIP tool against representative files before changing its status.
6. Only then consider adding new tools or merging overlapping capabilities.

## Scope and limitations of this audit

This audit records the catalog, navigation code, entry-point files, and readiness labels visible in the repository source. “Listed without WIP label” means only that the catalog does not mark the tool WIP; it is **not** a certification that the tool has passed a complete regression or cross-browser test suite.
