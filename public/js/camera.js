// Front camera: pick it by label, start it, apply exposure controls, grab one mirrored frame.

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(function (d) { return d.kind === 'videoinput'; });
}

export function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach(function (track) { track.stop(); });
}

// Device ids can change after a reboot, so we match on the label instead.
async function pickCamera(labelMatch) {
  let cameras = await listCameras();
  if (!cameras.some(function (c) { return c.label; })) {
    // Labels stay empty until camera permission has been granted once.
    stopStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
    cameras = await listCameras();
  }
  const match = cameras.find(function (c) { return c.label.indexOf(labelMatch) !== -1; });
  if (match) return match;
  console.warn('[camera] no camera label contains "' + labelMatch + '", using the first one:',
    cameras.length ? cameras[0].label : '(none found)');
  return cameras[0] || null;
}

// One applyConstraints call for everything: a later call would replace the earlier one.
// Keys the camera doesn't support are skipped so a bad config can't stop the camera starting.
async function applyControls(track, cameraConfig) {
  const wanted = cameraConfig.controls || {};
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  const supported = {};
  Object.keys(wanted).forEach(function (key) {
    if (key in caps) supported[key] = wanted[key];
    else console.warn('[camera] control "' + key + '" not supported — skipped');
  });
  if (Object.keys(supported).length === 0) return;
  try {
    await track.applyConstraints({
      width: { ideal: cameraConfig.width },
      height: { ideal: cameraConfig.height },
      advanced: [supported]
    });
    console.info('[camera] controls applied:', supported);
  } catch (err) {
    console.warn('[camera] could not apply controls', err);
  }
}

export async function startCamera(cameraConfig) {
  const camera = await pickCamera(cameraConfig.labelMatch);
  const video = { width: { ideal: cameraConfig.width }, height: { ideal: cameraConfig.height } };
  if (camera) video.deviceId = { exact: camera.deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: false });
  await applyControls(stream.getVideoTracks()[0], cameraConfig);
  return stream;
}

// Draws the current video frame at the camera's real size, mirrored like the preview.
export function captureFrame(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}
