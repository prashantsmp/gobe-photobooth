# GoBe Photobooth

A walk-up photobooth that runs on the GoBe telepresence robot's screen. Guests take one photo, pick a frame,
and download it by scanning a QR code. See `CLAUDE.md` for the full spec.

## Run it locally

```
npm run serve     # python3 -m http.server 3100 --directory public
npm test          # node --test, no dependencies to install
```

Open http://localhost:3100. Localhost counts as a secure page, so the camera works without HTTPS.
Open the browser console to see the camera size actually delivered and how long composing took.

## Publish

Every push to `main` publishes the `public/` folder to GitHub Pages (`.github/workflows/pages.yml`).

## Add a frame

1. Make a **1080 × 1920 PNG** with a transparent area where the photo should show.
2. Put it in its own folder: `public/frames/<frame-id>/frame.png`.
3. Add an entry to `public/frames/frames.json`. `window` is the rectangle (in pixels on the 1080 × 1920 canvas)
   the photo fills:
   ```json
   { "id": "<frame-id>", "name": "Shown name", "file": "<frame-id>/frame.png",
     "window": { "x": 60, "y": 200, "w": 960, "h": 1440 } }
   ```

## Switch the event

1. Create `public/events/<event-id>.json` listing up to 6 frame ids:
   ```json
   { "title": "Welcome", "frames": ["<frame-id>"], "defaultFrame": "<frame-id>" }
   ```
2. Set `"activeEvent": "<event-id>"` in `public/config.json`.
3. Push to `main`. No code changes needed.

## Remove from the robot

_To be written in Phase 7. It will be: delete `~/.config/autostart/photobooth.desktop` and reboot._
