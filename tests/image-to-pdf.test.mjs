import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateImagePageLayout, reorderImageItems } from '../image-to-pdf.js';

test('contain fits and centers an image inside the page',()=>{const r=calculateImagePageLayout(1600,900,600,800,'contain',20);assert.deepEqual(r,{x:20,y:231.25,width:560,height:315});});
test('cover fills usable page area and preserves aspect ratio',()=>{const r=calculateImagePageLayout(1600,900,600,800,'cover',20);assert.equal(r.width,1351.111111111111);assert.equal(r.height,760);assert.equal(r.x,-375.55555555555554);assert.equal(r.y,20);});
test('rejects invalid dimensions and impossible margins',()=>{assert.throws(()=>calculateImagePageLayout(0,100,600,800),/greater than zero/);assert.throws(()=>calculateImagePageLayout(100,100,20,20,'contain',12),/greater than zero/);});
test('reorders without mutating the source array',()=>{const a=['a','b','c'];assert.deepEqual(reorderImageItems(a,0,2),['b','c','a']);assert.deepEqual(a,['a','b','c']);});
test('rejects out-of-range reorder indexes',()=>{assert.throws(()=>reorderImageItems(['a'],0,2),/outside/);});
