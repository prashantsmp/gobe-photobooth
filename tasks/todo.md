# Plan — GoBe Photobooth v1

Status: **draft, waiting for owner confirmation** before any code is written.

Each phase ends with a check on the **real robot** (CLAUDE.md §13.5). Don't start the next phase until
the current one passes there. Commit at the end of every phase.

---

## Open questions (answer before or during the phase named)

- [x] **Static host** (before Phase 1): GitHub Pages can only publish the repo root or `/docs`. Publish `/public`
      with a small GitHub Actions workflow, or use another host? **Decided: Pages + Actions workflow.**
- [ ] **Server host + domain** (before Phase 4): where does `server/server.js` run, and on what HTTPS domain?
- [ ] **Camera resolution** (Phase 1): owner's test result for `camera.width/height` over HTTPS.
- [ ] **Real frame artwork** (Phase 3): until then we use placeholder frames we generate ourselves.
- [ ] **Autostart approval** (Phase 7): owner/vendor OK to add the autostart file to this robot.
- [ ] **Arabic UI**: out of scope unless the owner asks (§12).

---

## Phase 0 — Skeleton (laptop)

- [x] Create the folder layout from CLAUDE.md §14.
- [x] `public/config.json` with the §9 values (camera size = placeholder).
- [x] `public/events/default.json` + one placeholder frame `public/frames/plain-white/` (1080×1920 PNG
      with a transparent window) + `public/frames/frames.json`.
- [x] `index.html` fixed at 1080×1920, `style.css`, empty `app.js` that loads config → event → frames.
- [x] README stub: how to add a frame, switch event, remove from robot.
- [ ] Publish `/public` to the chosen static host. _(workflow written; waiting on GitHub repo)_

**Check:** page loads on the robot over HTTPS, no console errors.

## Phase 1 — First milestone: capture → one frame → on screen (robot)

- [ ] ATTRACT screen (camera off, privacy line from §10).
- [ ] Camera start: pick device by label `2bc5:0511`, fall back to the first camera with a warning;
      request `ideal` size, log the real size; apply `camera.controls` in try/catch.
- [ ] PREVIEW (mirrored) with "Look here ↑" cue at the top.
- [ ] COUNTDOWN at the top of the screen, `countdownSeconds` from config.
- [ ] CAPTURE: draw to a raw canvas at real resolution, mirrored; stop the camera straight after.
- [ ] Compose: cover-fit into `window` (centre horizontally, 40% from top) → frame PNG on top → JPEG 0.9.
      Log compose + encode time.
- [ ] Show the composed photo with "Retake" (restarts camera) and "Done" (back to ATTRACT).

**Check on robot:** front camera chosen, real resolution logged, photo mirrored like the preview,
compose + encode < 1 s, face visible.

## Phase 2 — Robustness

- [ ] State machine from §5.1 in one place; idle timeout → ATTRACT on every non-ATTRACT screen.
- [ ] PAUSED screen when the track ends or `NotReadableError`; retry every 10 s; recover to ATTRACT.
- [ ] Frame validation at load (§4.5): missing / wrong size / window outside the canvas → skip and log;
      no valid frames → plain photo.
- [ ] Clean-up on return to ATTRACT: clear canvases, revoke blob URLs.

**Check on robot:** start a telepresence call mid-session → PAUSED → recovers. Broken frame file is skipped.

## Phase 3 — Choosing a frame

- [ ] CHOOSE FRAME screen: swipe between active frames, re-compose from the same raw photo.
- [ ] Skip the screen when only one frame is active; cap at 6 frames.
- [ ] Second placeholder event to prove switching occasion = config + PNGs only.

**Check on robot:** swiping is smooth with touch; switching `activeEvent` changes frames with zero code change.

## Phase 4 — Backend

- [ ] `server/server.js` (Express, one file): `POST /upload` (JPEG only, max 5 MB, random 22-char id),
      `GET /p/:id` mobile page with a big "Save photo" button, hourly cleanup using `retentionHours`
      read from `../public/config.json`.
- [ ] CORS limited to the screen app's origin.
- [ ] Tests (`node --test`): upload accepts a JPEG, rejects non-JPEG and >5 MB; old files are deleted.
- [ ] Deploy on HTTPS.

**Check:** upload from a laptop with curl; open `/p/<id>` on a phone and save the photo.

## Phase 5 — Upload + QR

- [ ] UPLOADING: POST to `uploadUrl`, 10 s timeout, 3 tries with 2 s gaps.
- [ ] ERROR screen with "Try again" / "Start over".
- [ ] SHARE: QR from the returned URL with the vendored `public/vendor/qrcode.min.js`, ≥ 500×500,
      black on white, quiet margin, short URL text below; auto-return after `shareScreenSeconds`.

**Check on robot:** capture → QR < 5 s; QR scans first try from 50 cm on iPhone + Android;
Wi-Fi pulled mid-upload → ERROR → "Try again" works once the network is back.

## Phase 6 — Finishing touches

- [ ] Countdown beep + shutter sound at `soundVolume`.
- [ ] Final copy and layout check: buttons in the y = 700–1500 band.

## Phase 7 — Install on the robot (after owner/vendor OK)

- [ ] `~/.config/autostart/photobooth.desktop` with the kiosk command from §7 (confirm the binary name first).
- [ ] README: install and removal steps.

**Check:** reboot → booth starts in kiosk mode; delete the file → reboot → robot is back to stock.

## Phase 8 — Definition of done (§11)

- [ ] Run the full §11 checklist on the robot, including 20 guests in a row and 8 hours with memory checked.
- [ ] First event's deployment checklist.

---

## Review

_(fill in after each phase: what was done, what broke, what changed in the plan)_
