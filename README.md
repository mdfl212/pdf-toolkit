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

The **Chapter Extractor is the primary tool** and the first screen when the app opens. It is designed for splitting textbook PDFs by embedded bookmarks, with an optional AI-assisted page-range workflow for files without bookmarks. Other tools are grouped by task so beginners can start with common actions and open less-used tools when needed.

| Category | Tool | What it does |
|----------|------|----------------|
| **Main tool** | **Chapter Extractor** | Split textbooks into individual chapter PDFs using bookmarks or an AI-assisted page-range list |
| **Advanced workflow** | **Batch Processor** | Run multiple PDF operations in one batch and download the results together |
| **Quick tasks** | **OCR & Searchable PDF** | Add an invisible English text layer to scanned pages while keeping visible page artwork |
| **Quick tasks** | **Compress PDF** | Try basic PDF optimization or stronger image compression |
| **Quick tasks** | **Merge** | Combine multiple PDFs |
| **Quick tasks** | **Split / Extract** | Extract custom page ranges or split a document into individual pages |
| **Organize pages** | **Delete pages** | Remove selected pages |
| **Organize pages** | **Rotate** | Rotate pages by 90°, 180°, or 270° |
| **Organize pages** | **Reorder** | Change page order |
| **Study & info** | **Chapter Extractor** | Extract textbook chapters using bookmarks or an imported page-range list |
| **Study & info** | **Metadata** | Inspect document information |
| **More tools** | **Watermark** | Add a diagonal text overlay |

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

Everything runs **in your browser**. Files are not uploaded to a server.

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


### OCR searchability and layout modes

The OCR tool adds an invisible text layer to scanned pages so PDF viewers can search and highlight recognized words; it does not reconstruct editable tables. The page-layout selector offers automatic, single-column, single-block, and sparse-text modes so users can choose a segmentation strategy appropriate to the scan. Pages with an existing usable text layer are skipped to avoid duplicate overlapping text. Selectable text alone does not prove recognition accuracy, and defective existing text layers are not automatically repaired. Validate output in a PDF viewer by searching for known terms and confirming that highlights align with the printed text. See [the OCR searchability regression checklist](docs/OCR_SEARCHABILITY_TESTS.md).

### OCR validation status

The repository runs automated static regression checks for OCR layout-mode wiring, invisible text-layer insertion, render-size/resource cleanup safeguards, existing-text-layer skip behavior, service-worker cache versioning, and documentation links. These checks catch source regressions; they do **not** prove OCR spelling accuracy, PDF-viewer search/highlight alignment, or offline behavior on a real device. Use the manual acceptance checklist in [docs/OCR_SEARCHABILITY_TESTS.md](docs/OCR_SEARCHABILITY_TESTS.md) before treating an OCR change as fully validated.
