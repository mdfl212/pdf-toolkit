import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(new URL('../pdf-toolkit.html', import.meta.url), 'utf8');
const catalogSource = html.match(/const toolCatalog = \[([\s\S]*?)\n    \];/);
const categorySource = html.match(/const toolCategories = \[([\s\S]*?)\n    \];/);

assert.ok(catalogSource, 'toolCatalog must be declared');
assert.ok(categorySource, 'toolCategories must be declared');

const tools = [...catalogSource[1].matchAll(/\{\s*id:'([^']+)'[\s\S]*?name:'([^']+)'[\s\S]*?category:'([^']+)'[\s\S]*?description:'([^']+)'/g)]
  .map(([, id, name, category, description]) => ({ id, name, category, description }));
const categories = [...categorySource[1].matchAll(/\{\s*id:'([^']+)'[\s\S]*?name:'([^']+)'[\s\S]*?description:'([^']+)'/g)]
  .map(([, id, name, description]) => ({ id, name, description }));
const staticPanels = new Set([...html.matchAll(/id="panel-([^"]+)"/g)].map(([, id]) => id));

// These tools create their panel in a separately loaded module at runtime.
const modulePanels = new Set([
  'text-extract', 'blank-pages', 'security', 'ocr', 'pdf-images', 'image-pdf',
  'docx-pdf', 'pdf-docx', 'additional-formats', 'figure-images'
]);

test('catalog has 23 unique tools with complete metadata', () => {
  assert.equal(tools.length, 23);
  assert.equal(new Set(tools.map(tool => tool.id)).size, tools.length, 'tool IDs must be unique');
  for (const tool of tools) {
    assert.ok(tool.name.trim(), tool.id + ' needs a name');
    assert.ok(tool.description.trim(), tool.id + ' needs a description');
    assert.ok(tool.category.trim(), tool.id + ' needs a category');
  }
});

test('every tool references a declared category', () => {
  const categoryIds = new Set(categories.map(category => category.id));
  assert.equal(categories.length, 7);
  for (const tool of tools) assert.ok(categoryIds.has(tool.category), tool.id + ' uses unknown category ' + tool.category);
});

test('every tool resolves to a static panel or a registered module panel', () => {
  for (const tool of tools) {
    assert.ok(staticPanels.has(tool.id) || modulePanels.has(tool.id),
      tool.id + ' has no known panel registration');
  }
});

test('navigation uses the central tool-opening API and captures legacy tool triggers', () => {
  assert.match(html, /window\.PDFToolkitOpenTool\s*=\s*openTool/);
  assert.match(html, /document\.addEventListener\('click',[\s\S]*?\.tool-btn\[data-panel\]/);
  assert.match(html, /stopImmediatePropagation\(\)/);
});

test('category counts sum to the catalog size', () => {
  const counts = categories.map(category => tools.filter(tool => tool.category === category.id).length);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), tools.length);
});
