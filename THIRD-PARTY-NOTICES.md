# Third-party notices

## qpdf-run browser worker

The local `qpdf-worker.js` file is adapted from the worker in
[qpdf-run](https://github.com/RabbitHols/qpdf-run), Copyright (c) 2026
CrabPDF contributors, under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

## qpdf WebAssembly runtime

The qpdf WebAssembly runtime is loaded from the `qpdf-run` npm package at
runtime. qpdf is Copyright (c) 2005-2021 Jay Berkenbilt, 2022-2026 Jay
Berkenbilt and Manfred Holger, and is licensed under the Apache License,
Version 2.0. See <https://github.com/qpdf/qpdf> and
<https://www.apache.org/licenses/LICENSE-2.0>.

The qpdf runtime and WebAssembly file are fetched from jsDelivr when the
repair engine is first used. PDF document bytes are passed to the local
Web Worker and are not uploaded to the CDN.
## docx-preview

This project loads docx-preview 0.4.1 from jsDelivr at runtime.
Copyright (c) 2016-2023 Volodymyr Baydalka. Licensed under the Apache License, Version 2.0.
Source: https://github.com/VolodymyrBaydalka/docxjs
A copy of the license is included at `licenses/docx-preview-Apache-2.0.txt`.


## docx

This project loads the browser build of `docx` 9.15.1 from jsDelivr to generate editable Office Open XML documents. Copyright (c) 2016 Dolan. Licensed under the MIT License. A copy is included at `licenses/docx-MIT.txt`.
Source: https://github.com/dolanmiu/docx


## SheetJS Community Edition

The XLSX to PDF workflow loads SheetJS Community Edition 0.20.3 from the official SheetJS CDN to read workbook data locally in the browser. Licensed under the Apache License, Version 2.0. Source and license: https://git.sheetjs.com/SheetJS/sheetjs and https://www.apache.org/licenses/LICENSE-2.0.

## rtf.js

The RTF to PDF workflow loads rtf.js 3.0.9 from jsDelivr to render RTF content locally in the browser. Copyright (c) 2015 Thomas Bluemel. Licensed under the MIT License. Source: https://github.com/tbluemel/rtf.js.

## Office Kit PPTX renderer

The PowerPoint to PDF workflow loads @office-kit/pptx and @office-kit/pptx-preview 0.28.0 from esm.sh to render slides locally in the browser. Licensed under the MIT License. Source: https://github.com/office-kit/pptx.
