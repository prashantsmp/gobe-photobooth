# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project: GoBe Photobooth.** Read this whole file before writing code. Read `tasks/lessons.md` if it exists.

## Stack deviation (this file wins over global defaults)

This project deliberately does **not** use the global DAK stack (Vue + FastAPI + Postgres, EZ Design System,
`PROJECT.md`/`CONVENTIONS.md`). Reasons:
- The screen app runs on **Chromium 91** on an ARM robot (§2, §6). A plain static site with no build step and
  vendored libraries is the safest thing that runs there; a modern SPA toolchain adds risk with no gain.
- The backend is one upload endpoint with no database (§8) — a one-file Express server is enough.
- The QR code is **black on white** on purpose (scan reliability beats the warm-neutral palette).
- Planning lives in `tasks/todo.md` and `tasks/lessons.md` instead of `PROJECT.md`/`CONVENTIONS.md`.

When a global rule conflicts with this file, follow this file.

---

## 1. What we are building

A walk-up photobooth that runs **on the GoBe telepresence robot's own screen**.

Guest taps the screen → sees themselves → countdown → **one photo** is taken →
guest swipes through the frames loaded for today's occasion and picks one →
QR code appears → guest scans with their phone and downloads the framed photo →
screen resets for the next guest.

**"Generic" means one thing here:** frames and event text change by editing files,
never by changing code. A new occasion = drop in new frame PNGs + edit one JSON file.
It does **not** mean an admin panel, user accounts, or multi-robot management.

---

## 2. The robot — measured facts (Phase 0, 24 Sep 2026, real unit)

These were tested on the robot. Treat them as the truth. Do not assume a normal laptop.

| Fact | Value | What it means for the code |
|---|---|---|
| OS | Ubuntu, **aarch64** (Firefly ARM board), user `firefly`, passwordless `sudo` | ARM builds only. Don't use `sudo` for the app — nothing we ship needs it. |
| Browser | **Chromium 91** (2021). Will not auto-update. | See §6 — many modern JS/CSS features are missing. Always test on the robot. |
| Screen | 1080 × 1920 portrait, pixel ratio 1, 15-point touch | Design at exactly 1080 × 1920. No retina assets needed. |
| Cameras | **5 USB cameras.** Front (guest-facing) one = `USB Camera (2bc5:0511)` | Select the camera **by label match**, not deviceId (IDs can change after reboot). |
| Front camera | Sensor max 2592 × 1944, 60 fps max, starts in ~250 ms | Over HTTPS it often falls back to 1280 × 720. Ask for exact size and **check what came back**. |
| Camera controls | brightness, contrast, exposureMode, exposureTime, colorTemperature, whiteBalanceMode, sharpness | Use these to fix the dark-face problem (§5.4). |
| Hosting | HTTPS page on GitHub Pages loaded fine and got camera access | The screen app can be a static site. |
| Internet | Reachable, 40–110 ms | QR upload is viable. Robot can switch Wi-Fi ↔ LTE — expect brief drops. |
| Browser UI | Tabs, address bar and **downloads bar** are visible | Must run in kiosk mode (§7). Never trigger file downloads on the robot. |

**Still open (do not guess — read from `config.json`, which has placeholders):**
- Best capture resolution over HTTPS (2592×1944 vs 1600×1200 vs 1280×720). Owner is testing.
- Whether a telepresence call takes the front camera away mid-session.

---

## 3. GoBe-specific rules (the robot is not a kiosk PC)

1. **The robot belongs to the GoBe software first.** It is a telepresence robot. Our app is a guest on it.
   - Do not install system packages, edit system files, disable services, or touch GoBe's menu tools
     (Force Relay, Restart Services, etc.). The vendor's updates may wipe anything we change there.
   - Everything we put on the robot lives in the `firefly` home folder and can be removed by deleting it.
2. **A call can steal the camera.** If the camera track ends or `getUserMedia` throws `NotReadableError`,
   show a calm "Photobooth paused" screen and retry every 10 s. Never crash, never show a raw error.
3. **The robot moves and docks.** Network may drop while it drives or switches Wi-Fi ↔ LTE.
   Uploads must retry (§5.6). The screen app itself must keep working offline — only the QR step needs internet.
4. **Camera sits above the screen.** Guests look at the screen, not the lens, so photos show eyes looking down.
   Put the countdown numbers and a "Look here ↑" cue at the **top** of the screen, close to the camera.
5. **Height.** The screen is at standing-adult height. Keep all buttons in the vertical middle band
   (roughly y = 700–1500) so children and wheelchair users can reach them.
6. **Speakers exist.** A short beep per countdown second and a shutter sound are allowed. Keep volume in config.
7. **Heat and battery.** Turn the camera **off** on the attract screen. Only run it while a guest is active.
8. **Lighting is a setup problem, not only a code problem.** Backlit guests (bright window behind them) come
   out dark. Code does its best (§5.4); the deployment checklist (§10) makes placement explicit.

---

## 4. Frames — how "one photo, many frames" works

### 4.1 Folder layout
Both folders live **inside `/public`** so the static host serves them alongside the app
(a frame's `file` is relative to `/public/frames`).
```
/public/frames
  frames.json          # list of every frame we own
  eid-2026/frame.png   # one folder per frame
  eid-2026/thumb.png   # optional, else auto-generated
  dewa-expo/frame.png
  plain-white/frame.png
/public/events
  default.json         # which frames are active + event text
  eid-2026.json
```

### 4.2 `frames.json` — each frame describes itself
```json
[
  {
    "id": "eid-2026",
    "name": "Eid Mubarak",
    "file": "eid-2026/frame.png",
    "window": { "x": 90, "y": 260, "w": 900, "h": 1400 }
  }
]
```
- Every `frame.png` is **1080 × 1920**, PNG with a transparent area where the photo shows.
- `window` = the rectangle (in the 1080 × 1920 canvas) the photo must fill. Different frames may have
  different windows. A full-bleed overlay frame uses `{0,0,1080,1920}`.
- The photo is fitted to the window with **cover** (fill, crop the extra, never stretch), centred on the face area
  (for v1: horizontal centre, 40% from top).

### 4.3 Event file — what's live today
```json
{
  "title": "Welcome to DEWA",
  "frames": ["dewa-expo", "plain-white"],
  "defaultFrame": "dewa-expo"
}
```
The screen app loads `config.json` → `activeEvent` → that event file → only those frames.
**Changing occasion = change `activeEvent` in `config.json` and push.** No code.

### 4.4 Guest flow for frames
- Capture happens **once**. Keep the raw full-resolution photo in memory.
- Each frame is composed from that same raw photo. Swiping frames re-composes, never re-captures.
- Guest picks **one** frame → that one image is uploaded → one QR.
- If only one frame is active, skip the choose screen entirely.
- Maximum 6 active frames (more is a worse experience, not a better one).

**Assumption to confirm with owner:** guest chooses one frame. The alternative — guest gets the photo
in *all* frames — changes the upload and download page. Do not build it unless asked.

### 4.5 Frame validation (run at load time)
If a frame PNG is missing, is not 1080 × 1920, or its window is outside the canvas → skip that frame,
log it, carry on with the rest. If **no** valid frames remain, fall back to a plain photo with no frame.
The booth must never go down because of a bad frame file.

---

## 5. Screen app

### 5.1 Screens (state machine)
```
ATTRACT --tap--> PREVIEW --"Take photo"--> COUNTDOWN (3,2,1) --> CAPTURE
   ^                                                               |
   |                                                               v
   |                                  CHOOSE FRAME (swipe) <--"Retake"--> back to PREVIEW
   |                                        |
   |                                   "Use this"
   |                                        v
   |                                   UPLOADING --fail x3--> ERROR ("Try again" / "Start over")
   |                                        |
   +--- "Done" or idle timeout -------- SHARE (QR)

Any state --camera lost--> PAUSED (retry every 10 s) --camera back--> ATTRACT
```
Idle timeout on every non-ATTRACT screen → ATTRACT (default 60 s, in config).

### 5.2 Camera
- Find the camera whose label contains `config.camera.labelMatch` (`"2bc5:0511"`). If not found, use the first
  camera and log a warning.
- Request `config.camera.width × height` with `ideal`. After start, read the real size from the video element.
  Log it. Never assume the request was honoured.
- Preview is mirrored. The saved photo is mirrored the same way (guest gets what they saw).

### 5.3 Capture
- Draw the current video frame to one raw canvas at the camera's real resolution.
- Stop the camera right after capture (heat, and a guest isn't filmed while choosing a frame).
- Restart it only on "Retake".

### 5.4 Dark faces
- On camera start, apply `config.camera.controls` with `track.applyConstraints` (brightness, exposure, etc.),
  wrapped in try/catch — unsupported keys must not break start.
- Values are tuned on the robot at the venue, stored in config. No auto face detection in v1.

### 5.5 Compose
- Output canvas 1080 × 1920: draw photo into the frame's `window` (cover fit) → draw frame PNG on top → JPEG 0.9.
- Target: compose + encode under 1 s on the robot. Measure it.

### 5.6 Upload + QR
- POST the JPEG to `config.uploadUrl`. Timeout 10 s. Retry up to 3 times with 2 s gaps.
- Server returns `{ url }`. Draw the QR from that URL with the **locally bundled** QR library.
- QR size at least 500 × 500 px, black on white, with a quiet margin. Show the short URL text under it too.

---

## 6. Chromium 91 — do not use these

The robot's browser is from 2021. These will silently break on it:

| Don't use | Use instead |
|---|---|
| `array.at(-1)` (Chrome 92) | `array[array.length - 1]` |
| `Object.hasOwn` (93) | `Object.prototype.hasOwnProperty.call` |
| `structuredClone` (98) | `JSON.parse(JSON.stringify(x))` |
| CSS `:has()`, container queries, `dvh/svh` units, `@layer` | plain selectors, fixed 1080×1920 layout, `px` |
| `<dialog>` element (98) | a plain `div` overlay |
| CDN scripts | copy libraries into `/public/vendor/` |

Rule: **every change that touches camera, touch, layout or JS features is tested on the robot, not just a laptop.**

---

## 7. Running it on the robot

Keep the robot footprint tiny and removable.

- The screen app is a static site (GitHub Pages or our server). Nothing is installed on the robot except
  one autostart file.
- Launch Chromium in kiosk mode from `~/.config/autostart/photobooth.desktop` (user-level, no sudo):
  ```
  chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble \
    --autoplay-policy=no-user-gesture-required \
    --use-fake-ui-for-media-stream https://<host>/
  ```
  `--use-fake-ui-for-media-stream` auto-accepts the camera prompt. It's a testing flag; acceptable here
  because the kiosk only ever opens our URL. Confirm the exact binary name on the robot (`which chromium-browser chromium`).
- **To remove the photobooth:** delete that one `.desktop` file. Document this in the README.
- Confirm with the owner/vendor before enabling autostart on a robot that is also used for telepresence.

---

## 8. Backend (the only part not on the robot)

GitHub Pages can't receive uploads, so a small server is needed for the QR link.

- Node.js + Express, **one file** (`server/server.js`). HTTPS. Public internet (guests are on mobile data).
- `POST /upload` → saves JPEG as `<random 22-char id>.jpg` → returns `{ url: "https://<host>/p/<id>" }`.
- `GET /p/:id` → tiny mobile page showing the photo with a big "Save photo" button.
- Hourly job deletes photos older than `retentionHours` (default 24).
- Max upload size 5 MB. Reject anything that isn't a JPEG.
- No database. No listing page. No guessable IDs.

---

## 9. Config — `config.json`

Every timer, size, and URL lives here. No magic numbers in code.

```json
{
  "activeEvent": "default",
  "uploadUrl": "https://<host>/upload",
  "camera": {
    "labelMatch": "2bc5:0511",
    "width": 1280,
    "height": 720,
    "controls": {}
  },
  "countdownSeconds": 3,
  "idleTimeoutSeconds": 60,
  "shareScreenSeconds": 60,
  "soundVolume": 0.6,
  "retentionHours": 24
}
```
`camera.width/height` are placeholders until the resolution test is done. Owner fills them in.

`config.json` is the single source for both apps: the screen app fetches it, and `server/server.js` reads
`../public/config.json` at startup for `retentionHours`. Don't copy the value into the server.

---

## 10. Privacy (UAE PDPL — non-negotiable)

- Attract screen shows one plain line: photos are kept for 24 hours for download, then deleted.
- Nothing stays on the robot: clear canvases and blob URLs when returning to ATTRACT. No local saving,
  no downloads bar.
- No face recognition, no analytics that identify people.
- Retention period confirmed with the client before any public event.

---

## 11. Definition of done (v1)

Only counts when shown **on the real robot**:

- [ ] 20 guests in a row, no restart.
- [ ] Switching occasion = edit `config.json` + add PNGs only. Proven by swapping to a second event with zero code changes.
- [ ] A broken frame file (wrong size / missing) is skipped; the booth keeps running.
- [ ] Capture → QR on screen in under 5 s on venue network.
- [ ] QR scans first try from 50 cm (iPhone + Android). Photo opens and saves on the phone.
- [ ] Face is clearly visible in the photo at the chosen venue spot (owner signs off).
- [ ] Wi-Fi pulled mid-upload → ERROR screen → "Try again" works when network returns.
- [ ] Telepresence call during use → PAUSED screen → booth recovers after the call.
- [ ] 8 hours running without the page slowing (memory checked).
- [ ] Removing the autostart file fully returns the robot to stock behaviour.

### Deployment checklist (every event)
- [ ] Light falls on the guest's face; no bright window behind the guest.
- [ ] `activeEvent` set, frames load, test photo taken and scanned.
- [ ] Robot docked or battery above event duration.
- [ ] Robot not scheduled for telepresence calls during the event.

---

## 12. Out of scope for v1

Admin panel, frame upload UI, filters/stickers/AR, background removal, multiple photos per session,
GIFs/boomerangs, printing, email/SMS/WhatsApp, analytics dashboard, Arabic UI (ask owner — likely needed
for UAE events, but not yet requested), multi-robot management.

If you think one of these is needed, write down why and ask. Do not build it.

---

## 13. Working rules

1. **Think first.** State assumptions before code. Ambiguous → list options and ask.
2. **Plan first.** 3+ steps → write the plan in `tasks/todo.md`, get it confirmed.
3. **Simplest thing that works.** No speculative abstraction. One frame system, not a plugin system.
4. **Surgical edits.** Touch only what the task needs. Match existing style.
5. **Prove it on the robot.** Laptop success is not success.
6. **Bug fixes:** reproduce first, then fix.
7. **After any correction from the owner:** add it to `tasks/lessons.md`.
8. **Ship thin, early.** First milestone is capture → one frame → shown on screen, on the robot. Upload, QR and
   frame choosing come after that works.
9. **Plain English** in comments, commits and messages.

## 14. Folder layout

```
/public     # the published folder — this is what the static host serves
  index.html  style.css  config.json
  app.js    # screen flow (ES module entry)
  js/       # one job per file: setup.js (load config/event/frames), camera.js, compose.js
  vendor/qrcode.min.js
  frames/   (see §4)
  events/   (see §4)
/server     # not published; deployed separately
  server.js
/tests      # node --test, for the parts that don't need a browser (e.g. crop maths)
/tasks
  todo.md  lessons.md
package.json  # no dependencies; just `npm test` and `npm run serve`
CLAUDE.md
README.md   # includes: how to add a frame, how to switch event, how to remove from robot
```
