// Builds the final 1080 x 1920 JPEG: photo cover-fitted into the frame's window, frame PNG on top.

export const CANVAS = { w: 1080, h: 1920 };
export const FULL_WINDOW = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };

// Where the crop sits inside the photo. Same meaning as CSS object-position,
// so the live preview (object-position: 50% 40%) shows exactly what gets saved.
export const FOCUS = { x: 0.5, y: 0.4 };

const JPEG_QUALITY = 0.9;
const BACKGROUND = '#faf9f7';

// The part of the source image that fills the window without stretching.
export function coverCrop(srcW, srcH, win) {
  const scale = Math.max(win.w / srcW, win.h / srcH);
  const sw = win.w / scale;
  const sh = win.h / scale;
  return { sx: (srcW - sw) * FOCUS.x, sy: (srcH - sh) * FOCUS.y, sw: sw, sh: sh };
}

// frameImage may be null (no valid frame): the photo then fills the whole canvas.
export function composePhoto(raw, win, frameImage) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.w;
  canvas.height = CANVAS.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CANVAS.w, CANVAS.h);

  const crop = coverCrop(raw.width, raw.height, win);
  ctx.drawImage(raw, crop.sx, crop.sy, crop.sw, crop.sh, win.x, win.y, win.w, win.h);
  if (frameImage) ctx.drawImage(frameImage, 0, 0, CANVAS.w, CANVAS.h);

  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      canvas.width = 0; // release the pixels straight away
      if (blob) resolve(blob);
      else reject(new Error('JPEG encode failed'));
    }, 'image/jpeg', JPEG_QUALITY);
  });
}
