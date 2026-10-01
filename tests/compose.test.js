import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop, FULL_WINDOW } from '../public/js/compose.js';

const PORTRAIT_WINDOW = { x: 60, y: 200, w: 960, h: 1440 };

function assertSameShape(a, b) {
  assert.ok(Math.abs(a.w / a.h - b.w / b.h) < 1e-9, `${a.w}x${a.h} should match ${b.w}x${b.h}`);
}

test('landscape camera into a portrait window crops the sides, keeps full height', () => {
  const crop = coverCrop(1280, 720, PORTRAIT_WINDOW);

  assert.equal(crop.sh, 720);
  assert.equal(crop.sw, 480);
  assertSameShape({ w: crop.sw, h: crop.sh }, PORTRAIT_WINDOW);
  assert.equal(crop.sx, (1280 - 480) / 2); // centred horizontally
  assert.equal(crop.sy, 0);
});

test('tall source is cropped top and bottom with the focus 40% from the top', () => {
  const crop = coverCrop(1000, 4000, FULL_WINDOW);

  assert.ok(Math.abs(crop.sw - 1000) < 1e-9, 'full width is used');
  assertSameShape({ w: crop.sw, h: crop.sh }, FULL_WINDOW);
  assert.ok(Math.abs(crop.sy - (4000 - crop.sh) * 0.4) < 1e-9);
});

test('source with the same shape as the window is used whole', () => {
  const crop = coverCrop(540, 960, FULL_WINDOW);

  assert.deepEqual(crop, { sx: 0, sy: 0, sw: 540, sh: 960 });
});

test('crop never reaches outside the source image', () => {
  const sizes = [[1280, 720], [2592, 1944], [1600, 1200], [720, 1280]];
  for (const [w, h] of sizes) {
    const crop = coverCrop(w, h, PORTRAIT_WINDOW);
    assert.ok(crop.sx >= 0 && crop.sy >= 0, `${w}x${h} starts inside`);
    assert.ok(crop.sx + crop.sw <= w + 1e-9 && crop.sy + crop.sh <= h + 1e-9, `${w}x${h} ends inside`);
  }
});
