// GoBe Photobooth — screen app.
// Must run on Chromium 91: no array.at, Object.hasOwn, structuredClone, the dialog element (see CLAUDE.md §6).
'use strict';

// Loads config.json -> the active event file -> only that event's frames.
// JSON is fetched with no-store so an edited config takes effect on the next page load.
async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ')');
  }
  return response.json();
}

async function loadSetup() {
  const config = await fetchJson('config.json');
  const event = await fetchJson('events/' + config.activeEvent + '.json');
  const allFrames = await fetchJson('frames/frames.json');

  const frames = event.frames
    .map(function (id) {
      const frame = allFrames.find(function (f) { return f.id === id; });
      if (!frame) console.warn('[frames] "' + id + '" is in the event but not in frames.json — skipped');
      return frame;
    })
    .filter(Boolean);

  return { config: config, event: event, frames: frames };
}

async function start() {
  const title = document.getElementById('event-title');
  const status = document.getElementById('status');
  try {
    const setup = await loadSetup();
    title.textContent = setup.event.title;
    status.textContent = setup.frames.length + ' frame(s) loaded';
    console.info('[setup] event "' + setup.config.activeEvent + '", frames:',
      setup.frames.map(function (f) { return f.id; }));
  } catch (err) {
    // Never show a raw error to guests; log it for us.
    console.error('[setup]', err);
    title.textContent = 'Photobooth';
    status.textContent = 'Starting up…';
  }
}

start();
