# PDF Toolkit · StudyMats

**Client-side chapter extractor for textbooks** — built for medical students and anyone who needs clean chapter PDFs for [NotebookLM](https://notebooklm.google.com/), Anki, or syllabus-aligned study packs.

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

## Other tools in the app

| Tool | What it does |
|------|----------------|
| **Merge** | Combine multiple PDFs |
| **Split / Extract** | Custom page ranges or one file per page |
| **Delete pages** | Remove selected pages |
| **Rotate** | 90° / 180° / 270° |
| **Reorder** | Drag-and-drop page order |
| **Watermark** | Diagonal text overlay |
| **Metadata** | Title, author, page count, etc. |

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
