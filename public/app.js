// GoBe Photobooth — screen app: ATTRACT -> PREVIEW -> COUNTDOWN -> CAPTURE -> RESULT.
// Must run on Chromium 91: no array.at, Object.hasOwn, structuredClone, the dialog element (see CLAUDE.md §6).
import { loadSetup, loadImage } from './js/setup.js';
import { startCamera, stopStream, captureFrame } from './js/camera.js';
import { composePhoto, FULL_WINDOW, FOCUS } from './js/compose.js';

const ONE_SECOND_MS = 1000;

const state = {
  config: null,
  window: FULL_WINDOW, // where the photo goes on the 1080 x 1920 canvas
  frameImage: null,    // null = plain photo, no frame
  stream: null,
  raw: null,           // full-resolution capture, kept until the guest is done
  photoUrl: null,
  busy: false
};

function el(id) { return document.getElementById(id); }

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

function show(name) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.classList.toggle('is-active', screen.id === 'screen-' + name);
  });
}

function stopCamera() {
  stopStream(state.stream);
  state.stream = null;
  el('preview-video').srcObject = null;
}

// Nothing of the guest stays in memory once they leave (CLAUDE.md §10).
function clearPhoto() {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = null;
  el('result-photo').removeAttribute('src');
  if (state.raw) state.raw.width = 0;
  state.raw = null;
}

async function startSession() {
  if (state.busy) return;
  state.busy = true;
  el('attract-message').textContent = '';
  try {
    state.stream = await startCamera(state.config.camera);
    const video = el('preview-video');
    video.srcObject = state.stream;
    await video.play();
    console.info('[camera] asked for ' + state.config.camera.width + 'x' + state.config.camera.height +
      ', got ' + video.videoWidth + 'x' + video.videoHeight);
    el('preview').classList.remove('is-counting');
    show('preview');
  } catch (err) {
    // Phase 2 replaces this with the PAUSED screen.
    console.error('[camera] could not start', err);
    stopCamera();
    el('attract-message').textContent = 'The camera is busy. Please try again in a moment.';
    show('attract');
  } finally {
    state.busy = false;
  }
}

async function takePhoto() {
  if (state.busy) return;
  state.busy = true;
  el('preview').classList.add('is-counting');
  for (let n = state.config.countdownSeconds; n > 0; n--) {
    el('countdown').textContent = String(n);
    await sleep(ONE_SECOND_MS);
  }
  try {
    state.raw = captureFrame(el('preview-video'));
    stopCamera(); // heat, and the guest isn't filmed while looking at the result
    if (state.raw.width === 0) throw new Error('camera gave an empty frame');
    await showResult();
  } catch (err) {
    console.error('[capture] failed', err);
    stopCamera();
    clearPhoto();
    show('attract');
  } finally {
    state.busy = false;
  }
}

async function showResult() {
  const started = performance.now();
  const blob = await composePhoto(state.raw, state.window, state.frameImage);
  console.info('[compose] ' + state.raw.width + 'x' + state.raw.height + ' -> JPEG ' +
    Math.round(blob.size / 1024) + ' KB in ' + Math.round(performance.now() - started) + ' ms');
  state.photoUrl = URL.createObjectURL(blob);
  el('result-photo').src = state.photoUrl;
  show('result');
}

function retake() {
  clearPhoto();
  startSession();
}

function done() {
  clearPhoto();
  show('attract');
}

// Places the live preview exactly where the photo will sit in the frame, frame on top.
function layoutPreview(frame) {
  const video = el('preview-video');
  video.style.left = state.window.x + 'px';
  video.style.top = state.window.y + 'px';
  video.style.width = state.window.w + 'px';
  video.style.height = state.window.h + 'px';
  video.style.objectPosition = (FOCUS.x * 100) + '% ' + (FOCUS.y * 100) + '%';
  if (frame) el('preview-frame').src = 'frames/' + frame.file;
}

// Phase 1 uses one frame: the event's default, else its first. Choosing comes in Phase 3.
// Returns the frame in use, or null for a plain photo.
async function useFrame(setup) {
  const frame = setup.frames.find(function (f) { return f.id === setup.event.defaultFrame; }) ||
    setup.frames[0];
  if (!frame) {
    console.warn('[frames] no frames for this event — using a plain photo');
    return null;
  }
  try {
    state.frameImage = await loadImage('frames/' + frame.file);
    state.window = frame.window;
    return frame;
  } catch (err) {
    console.warn('[frames] "' + frame.id + '" failed to load — using a plain photo', err);
    return null;
  }
}

async function start() {
  try {
    const setup = await loadSetup();
    state.config = setup.config;
    el('event-title').textContent = setup.event.title;
    el('privacy').textContent = 'Photos are kept for ' + setup.config.retentionHours +
      ' hours so you can download them, then deleted.';
    layoutPreview(await useFrame(setup));
    el('screen-attract').addEventListener('click', startSession);
    el('btn-take').addEventListener('click', takePhoto);
    el('btn-retake').addEventListener('click', retake);
    el('btn-done').addEventListener('click', done);
  } catch (err) {
    // Never show a raw error to guests; log it for us.
    console.error('[setup]', err);
    el('event-title').textContent = 'Photobooth';
    el('attract-message').textContent = 'Starting up…';
  }
}

start();
