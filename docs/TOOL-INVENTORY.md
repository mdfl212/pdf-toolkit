# PDF Toolkit tool inventory

Audit basis: `pdf-toolkit.html` tool catalog and navigation, the page's registered panels and handlers, script imports, and the current README. This is an inventory of the current repository state, not a claim that every listed tool is production-ready.

## Existing tool catalog

| Category | Tool | Registry ID | Current status / notes |
|---|---|---|---|
| Split & Extract | Chapter Extractor | `chapters` | Implemented; bookmark-based chapter extraction |
| Split & Extract | Split / Extract Pages | `split` | Implemented; page ranges and individual-page splitting |
| Split & Extract | Extract Text | `text-extract` | Implemented; extracts selectable PDF text |
| Merge & Organize | Merge PDFs | `merge` | Implemented |
| Merge & Organize | Reorder Pages | `reorder` | Implemented |
| Merge & Organize | Rotate Pages | `rotate` | Implemented |
| Merge & Organize | Delete Pages | `delete` | Implemented |
| Merge & Organize | Bookmark Manager | `bookmarks` | Implemented; inspect/edit outline and write bookmarks |
| Merge & Organize | Remove Blank Pages | `blank-pages` | Implemented via separate module |
| OCR & Searchability | OCR & Searchable PDF | `ocr` | Available, explicitly marked WIP in UI and README |
| Compress & Optimize | Compress PDF | `compress` | Implemented; basic optimization and image-based stronger compression have different trade-offs |
| Protect & Manage | Watermark | `watermark` | Implemented |
| Protect & Manage | Password Protect | `security` | Implemented via separate security module |
| Inspect & Analyze | PDF Metadata | `metadata` | Implemented; metadata inspection/editing |
| Inspect & Analyze | Smart Document Assistant | `assistant` | Available, marked WIP; local extractive analysis, not generative AI |
| Inspect & Analyze | Repair PDF | `repair` | Available; repair path uses qpdf where available; retain this as diagnostic/recovery rather than general editing |
| Advanced Tools | Extract Figures | `figure-images` | Implemented via separate module |
| Advanced Tools | Word (DOCX) to PDF | `docx-pdf` | Available, marked WIP; browser renderer + native print/save as PDF |
| Advanced Tools | Additional formats to PDF | `additional-formats` | Available, marked WIP; XLSX, PPTX, ODT, RTF, HTML and TXT |
| Advanced Tools | PDF to editable DOCX | `pdf-docx` | Available, marked WIP; reconstructs editable text, not original layout |
| Advanced Tools | Images to PDF | `image-pdf` | Implemented via separate module |
| Advanced Tools | PDF to Images | `pdf-images` | Implemented via separate module |
| Advanced Tools | Batch Processor | `batch` | Implemented; multi-operation batch workflow |

**Current catalog count: 22 tools** across the seven categories.

## Existing discovery/navigation features

The current page already contains the proposed hybrid navigation foundation:

- Seven category filters, with a sidebar and mobile category navigation.
- Homepage tool search across tool names/descriptions.
- Tool cards with descriptions and favorite toggles.
- Favorites and the five most recently used tools stored in browser local storage.
- Common-task/document workspace entry point and upload-once PDF workspace.
- Shared active PDF is passed into supported tools without making each tool own the source upload.

Therefore, the category-based reorganization described in the project proposal is already substantially present in the current code. A second navigation rewrite would duplicate existing work and add regression risk. The next UI work should be targeted polish and coverage, not replacing this architecture.

## Category mapping decisions

- **Repair PDF** remains under **Inspect & Analyze** because its current purpose is diagnosis/recovery of damaged structure, not routine page editing.
- **Extract Figures** remains under **Advanced Tools** because it extracts embedded visual assets rather than reorganizing PDF pages.
- **PDF/DOCX and other format conversions** remain under **Advanced Tools** because they are specialized format workflows.
- **Batch Processor** remains under **Advanced Tools**. A future batch capability can be exposed as a homepage shortcut without creating a duplicate tool entry.
- **OCR** stays in its own category. Its WIP label must remain visible until accuracy and edge-case validation is complete.

## Proposed functions not currently represented as standalone tools

These were mentioned in the earlier category proposal but are **not present as standalone entries in the current tool catalog**. They should not be advertised as available until implemented and tested:

- Insert pages from another PDF.
- Create a new PDF from a blank page / insert blank pages.
- Linearize / fast-web-view optimization.
- Flatten forms/annotations.
- Remove arbitrary unused PDF objects.
- Dedicated batch compression.
- Standalone metadata removal.
- A distinct PDF structural-validation report beyond the existing metadata/repair flows.

Some related functionality may be achievable indirectly in existing workflows; this list means there is no dedicated catalog entry or verified standalone workflow for it.

## Recommended next actions

1. Preserve the existing category/search/favorites/recent-tools architecture.
2. Add automated coverage that verifies every catalog ID resolves to a usable panel or registered external module, and every tool has a valid category, description, and status.
3. Run browser smoke tests for all 22 tools, including shared active-file handoff and mobile navigation.
4. Prioritize reliability testing for the tools marked WIP: OCR, DOCX to PDF, additional formats to PDF, PDF to DOCX, and Smart Document Assistant.
5. After those checks, consider small UI improvements: clearer WIP labels, category counts, keyboard-accessible search, and a visible Common Tasks section.

## Source files observed

- `pdf-toolkit.html` — tool catalog, categories, navigation, tool cards, shared workspace and many PDF panels.
- `mobile-process.js`, `ocr.js`, `security.js`, `blank-pages.js`, `text-extract.js`, `pdf-to-images.js`, `image-to-pdf.js`, `docx-to-pdf.js`, `pdf-to-docx.js`, `additional-formats-to-pdf.js`, `smart-document-assistant.js`, `figure-images.js` — separately loaded processing/conversion modules.
- `README.md` — current user-facing feature inventory and WIP caveats.
