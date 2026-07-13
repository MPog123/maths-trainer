# Maths Trainer

A simple, installable web app (PWA) for Year 6 addition and subtraction practice.
Question types mirror the printed worksheets (`addition.tex` / `subtraction.tex`):

| Topic | Subtopics |
|---|---|
| Addition | Written Addition, Mental Addition, Mental Addition: 3+ Numbers |
| Subtraction | Written Subtraction, Mental Subtraction, Mental Subtraction: 3+ Numbers |

Questions are generated with the same digit-length patterns as the worksheets, and
subtraction questions are always non-negative (like `make_new_subtraction_sheet.py`).

Each subtopic is split into **difficulty levels** that follow the worksheet
progression (e.g. Mental Addition: 2-digit + 2-digit up to 4-digit + 3-digit),
plus a **Mixed** level that draws from all difficulties. Records are tracked
per level.

## Features

- Rounds of 10 questions, one at a time, with a big friendly number pad
- **Written** modes include a finger/Apple Pencil **working-out pad** (column method)
- Score (base + speed bonus + streak bonus), live timer, and streak counter
- Per-subtopic records saved on the device: **High Score**, **Best Streak**,
  **Best Time** (fastest perfect 10/10 round)
- Works fully offline once installed (service worker caches everything)

## Try it on this computer

From this folder, run:

```
python -m http.server 8000
```

then open http://localhost:8000 in a browser. (A plain double-click on
`index.html` also works, but the service worker/offline part needs a server.)

## Put it on the iPhone/iPad

The app needs to be hosted at an **https** URL. The easiest free option is
**GitHub Pages**:

1. Create a GitHub repository (e.g. `maths-trainer`) and push the contents of
   this folder to it.
2. In the repo: **Settings → Pages → Source: Deploy from a branch**, pick
   `main` and `/ (root)`, save.
3. After a minute the app is live at `https://<username>.github.io/maths-trainer/`.

Then on the iPhone/iPad:

1. Open that URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. It now opens full-screen from its own icon, works offline, and keeps its
   saved records. *(Important: data is stored on the device with
   `localStorage`. It persists indefinitely for a home-screen app, but would be
   lost if the app is deleted from the home screen.)*

Free alternatives to GitHub Pages: Netlify Drop (drag-and-drop this folder at
https://app.netlify.com/drop) or Cloudflare Pages.

## Future: a real App Store app?

Realistic paths, in increasing order of effort:

1. **Stay a PWA** (current) — free, instant updates, no review process.
2. **Wrap the PWA with Capacitor** (capacitorjs.com) — reuses this exact
   HTML/JS/CSS inside a native iOS shell; needs a Mac with Xcode and an Apple
   Developer account ($99/year) to ship to the App Store.
3. **Rewrite in Swift/SwiftUI** — best native feel, most work.

Option 2 is the natural next step: the whole app is already plain
HTML/CSS/JS with no build step, which is exactly what Capacitor wraps.

## File overview

- `index.html` — all four screens (home, subtopic, quiz, results)
- `style.css` — styling
- `app.js` — question generation, quiz flow, scoring, localStorage stats
- `sw.js` — service worker (offline caching)
- `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` — install/PWA bits

To add a new topic later (e.g. Multiplication), add an entry to the `TOPICS`
object at the top of `app.js` — the screens, stats, and scoring pick it up
automatically.
