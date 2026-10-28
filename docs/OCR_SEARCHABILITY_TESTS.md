# OCR Searchability Regression Tests

## Purpose

PDF Toolkit's OCR feature primarily adds an invisible, searchable text layer to scanned PDFs. It is not expected to recreate editable tables or produce perfectly formatted text extraction. Tests must prioritize successful search, correctly positioned highlights, and preservation of the original page image.

## Test fixtures

Keep representative fixtures in a test-only location if licensing and repository size permit. Do not commit private or copyrighted documents without permission.

- Scanned stock-listing page with two side-by-side lists and small print.
- Two-column textbook page.
- Low-resolution or mildly skewed scan.
- PDF with a good existing text layer.
- PDF with a present but defective text layer.
- Large-format page to exercise render-memory limits.

## Manual acceptance checklist

For each scanned fixture:

- [ ] Open the OCR output in at least one mainstream PDF viewer.
- [ ] Search for several known words or phrases in different regions of the page.
- [ ] Confirm each search result lands on the corresponding printed text.
- [ ] Confirm the invisible text layer covers the page, including both columns and page edges.
- [ ] Confirm the original page image remains visually unchanged.
- [ ] Confirm OCR output does not create duplicate or overlapping selectable text.
- [ ] Confirm the output opens after download and text remains searchable.

For a document that already has selectable text:

- [ ] Confirm a good text layer is preserved without unnecessary re-OCR.
- [ ] Confirm a defective text layer can be handled only through an explicit, documented repair workflow.
- [ ] Confirm the app does not silently add a second text layer on top of the existing one.

For offline and resource behavior:

- [ ] After the app and required OCR assets have been cached, disconnect the network and run OCR.
- [ ] Test a large page and a multi-page PDF for excessive memory use or browser crashes.
- [ ] Confirm cancellation and errors release resources and leave the source file unchanged.

## Stock-listing benchmark notes

The sample stock-listing scan is a useful qualitative fixture because it contains compact text and two separate column groups. Use clearly legible terms from both halves as search probes. For example, the printed entry 'BobEvn' should be tested as a search term and should highlight the printed word, not merely appear somewhere in extracted text.

Record spelling errors separately from searchability failures:

- **Search success:** The search term is present in the OCR text layer and can be found by the PDF viewer.
- **Highlight positioning:** The viewer highlights the corresponding printed word or phrase.
- **Recognition accuracy:** The OCR spelling matches the visible scan.
- **Visual preservation:** The rendered page remains visually unchanged.

A term appearing in text extraction alone does not prove that viewer search or highlight positioning works.

## Comparing OCR settings

When changing preprocessing or Tesseract settings, compare the same fixtures with the same search probes. Test enhancement on and off, and evaluate upscaling or deskewing only where relevant. Keep a change only when it improves search success or highlight alignment without damaging the page image, materially increasing failures, or making performance unacceptable.

Do not use editable-table reconstruction as an acceptance requirement for this feature.
