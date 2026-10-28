import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IMAGE_MAX_BYTES, fitUnder, isImageFile, shrinkImage } from './shrinkImage.js';

const KB = 1024;

test('the photo limit is 200 KB', () => {
  assert.equal(IMAGE_MAX_BYTES, 200 * KB);
});

test('fitUnder keeps the best quality at full size when it already fits', async () => {
  const calls = [];
  const blob = await fitUnder(200 * KB, async (scale, quality) => { calls.push([scale, quality]); return { size: 150 * KB }; });
  assert.equal(blob.size, 150 * KB);
  assert.deepEqual(calls, [[1, 0.85]]);
});

test('fitUnder lowers the quality, then shrinks the picture, until it fits', async () => {
  // Size falls with both quality and picture size, like a real JPEG.
  const encode = async (scale, quality) => ({ size: Math.round(1200 * KB * scale * scale * quality) });
  const blob = await fitUnder(200 * KB, encode);
  assert.ok(blob && blob.size <= 200 * KB, 'result fits');
  assert.ok(blob.size > 100 * KB, 'it did not shrink more than needed: ' + blob.size);
});

test('fitUnder gives up when nothing fits', async () => {
  assert.equal(await fitUnder(200 * KB, async () => ({ size: 5000 * KB })), null);
});

test('an image that is already small, and any non-image file, is returned unchanged', async () => {
  const small = { type: 'image/jpeg', size: 90 * KB, name: 'a.jpg' };
  assert.equal(await shrinkImage(small), small);
  const pdf = { type: 'application/pdf', size: 9000 * KB, name: 'rx.pdf' };
  assert.equal(await shrinkImage(pdf), pdf);
  assert.equal(isImageFile(pdf), false);
  assert.equal(isImageFile(small), true);
});
