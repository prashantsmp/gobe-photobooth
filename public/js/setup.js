// Loads config.json -> the active event file -> only that event's frames.
// JSON is fetched with no-store so an edited config takes effect on the next page load.

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ')');
  }
  return response.json();
}

export async function loadSetup() {
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

export function loadImage(src) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = function () { resolve(image); };
    image.onerror = function () { reject(new Error('Could not load image ' + src)); };
    image.src = src;
  });
}
