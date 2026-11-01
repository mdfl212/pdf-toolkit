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
