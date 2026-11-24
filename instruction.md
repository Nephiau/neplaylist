# Project Specification (v3.4): **NEPlaylist** — Audiophile Vinyl Player & Local FLAC/MP3 Deck (Daylight Gallery & Studio Edition)

> **Zero-Context AI Agent Implementation & Anti-Truncation Directive:**
>
> * **Deliverable Format:** Build a complete, runnable **Vite + React 18+ + TypeScript (`strict: true`) + Tailwind CSS** project (`package.json`, `vite.config.ts`, `index.html`, and modular `src/` files) that compiles cleanly via `npm install && npm run build` and runs in `npm run dev` or static preview (`vite preview`). Load Google Fonts (`Instrument Serif`, `Plus Jakarta Sans`, `Cormorant Garamond`, `JetBrains Mono`) in `index.html` with clean system font fallbacks if offline.
> * **Zero-Stub & Zero-Static-Noise Rule:** Never emit `// TODO` placeholders, omitted parsers, or stubbed DSP functions. Every file must be 100% implemented and executable. **CRITICAL AUDIO PURITY RULE:** Never generate white noise, pink noise, radio static, or crackle buffers anywhere in `audioEngine.ts`—all audio output (including the procedural boot loop) must be pure musical audio with zero static hiss.
> * **Execution Strategy:** Keep modules concise and non-repetitive. Build either via the **Multi-Subagent Architecture (Section 6)** or in **two non-truncated passes**:
>   * **Pass 1 (Config, Types, Engines & Hooks):** `package.json`, `vite.config.ts`, `index.html`, `src/index.css`, `src/types/neplaylist.ts`, `src/utils/audioEngine.ts`, `src/utils/metadataParser.ts`, `src/utils/colorExtractor.ts`, `src/utils/lrcParser.ts`, `src/utils/storage.ts`, `src/hooks/useTurntablePhysics.ts`, and `src/hooks/useOutputDevice.ts`.
>   * **Pass 2 (UI Components, Portals & App Shell):** `src/components/BootPreloader.tsx`, `src/components/Header.tsx`, `src/components/TrackListPanel.tsx`, `src/components/VinylTurntable.tsx`, `src/components/AlbumShowcasePanel.tsx`, `src/components/BottomTransportDock.tsx`, `src/components/AudioRackDrawer.tsx`, `src/components/ArtworkLyricsModal.tsx`, `src/components/FloatingMiniDeck.tsx`, `src/components/SearchModal.tsx`, and `src/App.tsx`.

---

## 1. Visual Impression, Stack & Project Architecture

Build a responsive web application titled **`NEPlaylist`** (`<title>NEPlaylist</title>`), an audiophile vinyl turntable player and local `.flac`/`.mp3` music deck styled with an **airy Daylight Gallery & Creative Studio aesthetic**.

### Visual Mood & User Impression
* **Airy Alabaster Canvas & Micro-Dot Studio Grid:** Sits on a warm gallery alabaster canvas (`#F7F6F2`) layered with an architectural micro-dot grid and subtle radial ambient lighting.
* **Sculptural Objecthood:** High-contrast ink-black typography (`#141413`), solid ink-black pill CTAs, and the deep obsidian **12-inch grooved vinyl record** sit atop frosted translucent white cards (`rgba(255, 255, 255, 0.85)`, `backdrop-filter: blur(18px)`) with soft diffuse shadows.
* **Tactile Creative-Studio Details:**
  * Editorial serif display headings (`Instrument Serif` / `Cormorant Garamond`) paired with tight-tracked Neo-Grotesque UI typography (`Plus Jakarta Sans`) and tabular `JetBrains Mono` telemetry.
  * A **fanned, overlapping deck of rounded-square album sleeves** with floating **speech-bubble pill badges** (`@ArtistName`) above the active sleeve.
  * Subtle **creative-studio selection frames** (`1.5px` blueprint border with corner anchor squares, `❖` diamond labels, and a telemetry dimension pill like `33⅓ RPM • 118 BPM`), a delicate **rotating circular typographic stamp seal** (`ANALOG LISTENING ROOM • HIGH FIDELITY •`) in the upper-right stage corner, and a **centered floating frosted-glass transport dock** along the bottom edge.

### Technology Stack & Exact NPM Packages (`package.json`)
* **Core:** `react` (`^18.3.1`), `react-dom` (`^18.3.1`), `typescript` (`^5.5.0`), `vite` (`^5.4.0`), `@vitejs/plugin-react`, `tailwindcss` (`^3.4.0`), `postcss`, `autoprefixer`.
* **Shared-Element Morphs & Springs:** `motion` (`^11.15.0`, imported from `'motion/react'`).
* **Spectrum Visualizer:** `audiomotion-analyzer` (`^4.5.0`).
* **Streaming Tag & Cover Parser:** `music-metadata` (`^10.6.0`, using browser-native `parseBlob`—**do NOT** add `buffer` aliases or `vite-plugin-node-polyfills` to `vite.config.ts`).
* **Tempo Detection:** `web-audio-beat-detector` (`^8.2.0`).
* **Dominant Color Extraction:** `colorthief` (`^3.0.0`, using named ESM `getPaletteSync`).
* **Touch + Mouse Reordering:** `@dnd-kit/core` (`^6.1.0`), `@dnd-kit/sortable` (`^8.0.0`), `@dnd-kit/utilities` (`^3.2.2`).
* **Persistence & Icons:** `idb-keyval` (`^6.2.1`), `lucide-react` (`^0.450.0`), plus bespoke inline SVGs for the 12-inch grooved vinyl disc, S-shaped brushed chrome tonearm, circular stamp seal, and hardware icons.

### Project Directory Structure
```text
neplaylist/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── src/
    ├── main.tsx
    ├── index.css
    ├── App.tsx
    ├── types/
    │   └── neplaylist.ts
    ├── utils/
    │   ├── audioEngine.ts
    │   ├── metadataParser.ts
    │   ├── colorExtractor.ts
    │   ├── lrcParser.ts
    │   └── storage.ts
    ├── hooks/
    │   ├── useTurntablePhysics.ts
    │   └── useOutputDevice.ts
    └── components/
        ├── BootPreloader.tsx
        ├── Header.tsx
        ├── TrackListPanel.tsx
        ├── VinylTurntable.tsx
        ├── AlbumShowcasePanel.tsx
        ├── BottomTransportDock.tsx
        ├── AudioRackDrawer.tsx
        ├── ArtworkLyricsModal.tsx
        ├── FloatingMiniDeck.tsx
        └── SearchModal.tsx
```

### Scope Boundaries (What NOT to Build)
Keep the app strictly focused on local music playback and tactile gallery/studio aesthetics. **Do not include** user accounts, login/profile avatars, social feeds, notification bells, e-commerce/shopping UI ("Order", "Buy", pricing, carts), or any radio-static/white-noise audio generators.

---

## 2. Visual Design System, Textures & Typography

### Color & Surface Tokens (`src/index.css`)
* **Gallery Alabaster Canvas (`--bg-gallery`):** `#F7F6F2` layered with:
  1. Architectural micro-dot studio grid: `radial-gradient(rgba(20, 20, 19, 0.085) 1px, transparent 1px)` at `22px 22px` spacing.
  2. Warm ambient center wash: `radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.9) 0%, rgba(247, 246, 242, 0.4) 65%)`.
* **Frosted Glass Card (`--bg-glass`):** `rgba(255, 255, 255, 0.84)` with `backdrop-filter: blur(18px) saturate(140%)`, `border: 1px solid rgba(20, 20, 19, 0.08)`, `box-shadow: 0 20px 44px -14px rgba(20, 20, 19, 0.075)`.
* **Pure Plinth / Elevated Card (`--bg-pure`):** `#FFFFFF`, `border: 1px solid rgba(20, 20, 19, 0.07)`, `box-shadow: 0 12px 30px -8px rgba(20, 20, 19, 0.06)`.
* **Soft Mist & Unplayed Bars (`--bg-mist`):** `#EFECE6` (hover `#E6E2DA`; unplayed spectrum bars `#D6D3CD`).
* **Primary Ink & Solid Pill CTA (`--ink-primary`):** `#141413` with `#FFFFFF` text on primary pill buttons (`border-radius: 9999px`).
* **Secondary & Muted Ink:** `--ink-secondary: #575653`, `--ink-muted: #8C8A84`.
* **Studio Selection Blue (`--studio-blue`):** `#2563EB` (blueprint selection outline, corner anchor squares, and telemetry dimension pill).
* **Dual Daylight-Calibrated Artwork Accent Tokens (`600ms cubic-bezier(0.22, 1, 0.36, 1)` transitions):**
  1. **`--accent-dynamic` (default `#E04F3E`) & `--accent-dynamic-ink` (default `#FFFFFF`):** Rich solid fill token (`HSL Lightness` clamped to $42\%\text{–}56\%$, `Saturation` $\ge 65\%$) paired with luminance-contrasted foreground ink (`#141413` or `#FFFFFF`) for solid fills (active album speech-bubble badge, vinyl label halo).
  2. **`--accent-on-light` (default `#D43D2C`):** High-contrast daylight-ink token (`HSL Lightness` clamped to $\le 42\%$, `Saturation` $\ge 65\%$) used for active spectrum visualizer bars, active track accents, and colored text on `#F7F6F2` or white glass surfaces so pastel album covers never wash out.

### Typography Hierarchy
Load Google Fonts **`Instrument Serif`** (`400`, `400 italic`), **`Plus Jakarta Sans`** (`400, 500, 600, 700, 800`), **`Cormorant Garamond`** (`500 italic, 600 italic`), and **`JetBrains Mono`** (`400, 500, 600`) in `index.html`:
* **Brand Wordmark:** `NEPlaylist®`, `Plus Jakarta Sans` `700`, $19\text{px}\text{–}21\text{px}$, letter-spacing $-0.03em$, `#141413`.
* **Side Display Header (`A side` / `B side`):** `Instrument Serif` (with `Cormorant Garamond` fallback), $52\text{px}$ (mobile) to $68\text{px}$ (desktop), `#141413`, line-height $0.92$, letter-spacing $-0.02em$ (italicizing `side`, e.g., `A side`).
* **Album Title:** `Plus Jakarta Sans` `700`, $20\text{px}\text{–}24\text{px}$, `#141413`, letter-spacing $-0.03em$.
* **Synced Lyrics:** `Instrument Serif` / `Cormorant Garamond`, $22\text{px}\text{–}26\text{px}$ (`italic` `#141413` active line with `var(--accent-on-light)` indicator; `#9E9C96` inactive lines).
* **Telemetry:** `JetBrains Mono` (`font-variant-numeric: tabular-nums`), $10\text{px}\text{–}12\text{px}$.

### React `createPortal` Stacking Rule (CRITICAL)
Mount all dropdown popovers (Output Device / Gear Profile menu), floating scrub timestamp tooltips, slide-over drawers (`AudioRackDrawer`), modals (`ArtworkLyricsModal`, `SearchModal`), and Undo toasts via **`createPortal(..., document.body)`** (`z-index: 60+`), positioning popovers via `triggerEl.getBoundingClientRect()` so `overflow` containers never clip them.

---

## 3. Responsive Multi-Device Layout & Boot Pre-Loader

### Seamless Spinning-Vinyl Pre-Loader & `motion/react` FLIP Morph (`BootPreloader.tsx` + `App.tsx`)
* **External `<AnimatePresence>` Placement (CRITICAL):** In `App.tsx`, wrap `<AnimatePresence>` **outside** `{isBooting && <BootPreloader />}` inside `<MotionConfig reducedMotion="user">`. Immediately apply **`pointer-events-none`** to `BootPreloader`'s outer overlay (`position: fixed; inset: 0; z-index: 9999; background: #F7F6F2`) the instant `isBooting` turns `false` so the fading backdrop never blocks clicks on the turntable during its exit transition.
* **Shared-Element Platter Morph:** Render a centered $210\text{px}$ non-rotating circular shell **`<motion.div layoutId="neplaylist-platter-morph" style={{ borderRadius: 9999 }}>`** containing a **spinning 12-inch obsidian grooved vinyl disc** (`animation: spinBootVinyl 1.8s linear infinite`) and `#141413` `NEPlaylist®` + `CALIBRATING ANALOG DECK...` text. Place the matching `layoutId="neplaylist-platter-morph"` (`style={{ borderRadius: 9999 }}`, `transition={{ type: 'spring', stiffness: 260, damping: 28 }}`) on the **non-rotating circular platter container** inside `VinylTurntable.tsx` (while the inner vinyl SVG rotates independently inside it) to avoid $\sqrt{2}$ square-rotation bounding-box overshoot.
* **$1500\text{ms}$ Boot Safety Ceiling:** Resolve boot after `Promise.race([Promise.all([document.fonts.ready, hydrateLibrarySafe()]), sleep(1500)])` (with a $450\text{ms}$ minimum floor) so slow `IndexedDB` or Safari Private Browsing never freezes the pre-loader.

### Responsive Breakpoints (`Desktop`, `Tablet`, `Mobile`)

#### Desktop ($\ge 1024\text{px}$ — 3-Column Gallery Studio Stage)
* **Outer Shell:** `height: 100dvh; min-height: 620px; overflow: hidden` on `#F7F6F2`, accented by delicate curved hairline SVG connector arcs (`stroke: rgba(20, 20, 19, 0.08)`, `pointer-events: none`) linking the side cards toward the center plinth.
* **3-Column Grid (`grid-cols-12`, `gap-6`, `px-8`, `pb-24`):**
  * **Left (`4 cols`, `min-w-0`):** Floating frosted-white tracklist card (`TrackListPanel.tsx`) with bounded scrollable tracklist (`max-height: calc(100dvh - 300px); overflow-y: auto; padding-bottom: 124px`).
  * **Center (`4 cols`):** Sculptural matte-white turntable plinth (`#turntableChassis`, `width: clamp(240px, 27vw, 420px); aspect-ratio: 1 / 1`) + speed switch + studio dimension pill.
  * **Right (`4 cols`, `min-w-0`):** Fanned overlapping album sleeve deck (`AlbumShowcasePanel.tsx`), `@Artist` speech-bubble pill, centered album/lossless metadata, live output hardware pill, and dual-pill CTAs (`See Artwork` + `Synced Lyrics`).

#### Tablet ($768\text{px}\text{–}1023\text{px}$ — Two-Row Gallery Stage)
* Top row places the turntable plinth alongside the floating frosted tracklist card; below sits the fanned album sleeve deck (`pt-9 pb-4` vertical headroom inside horizontal scroll), output hardware pill, and dual CTAs, with `padding-bottom: calc(124px + env(safe-area-inset-bottom))` clearance above the floating bottom dock.

#### Mobile ($< 768\text{px}$ — Portrait Above-the-Fold & Landscape-Safe Vertical Flow)
* **Compact Single-Row Top Bar (`< 640px`):** Displays the `NEPlaylist®` wordmark, a compact `+ Files` pill, and collapses secondary controls (Search, Gear/Output, EQ Rack, Mini-Deck) into `36px × 36px` icon-only circular chips (`aria-label` required) so the header never wraps onto two rows on `360px–375px` screens.
* **Strict Mobile Vertical Stack Order (Above-the-Fold Vinyl Priority):**
  1. **Compact Turntable Stage:** Centered sculptural white plinth & obsidian vinyl sized via **`width: min(256px, 66vw, 38dvh); aspect-ratio: 1 / 1`** (`touch-action: pan-y` on outer wrapper so vertical page scrolling never triggers scratches), ensuring the spinning record stays visible above the fold on portrait phones and fits comfortably on short landscape phones, with the `BPM | 33⅓ | 45` switch and telemetry pill directly underneath.
  2. **Fanned Album Sleeve Deck & Output / Action Pills:** Horizontal swipeable fanned sleeves (`pt-9 pb-4` vertical headroom so `@Artist` speech bubbles never clip), compact gear profile / pitch micro-pills, and dual `See Artwork` + `Synced Lyrics` pills.
  3. **Tracklist Card:** Floating frosted-white card (`border-radius: 22px`) displaying the editorial serif `A side` / `B side` header, side/disc pills, and `min-height: 48px` touch rows, with `padding-bottom: calc(124px + env(safe-area-inset-bottom))` on the page container so the bottom track never hides under the floating transport dock.

---

## 4. Detailed Component Specifications

### A. Top Navigation Header (`Header.tsx`)
* **Left:** $36\text{px} \times 36\text{px}$ solid `#141413` rounded-square (`border-radius: 10px`) vinyl emblem + **`NEPlaylist®`** wordmark.
* **Center ($\ge 768\text{px}$):** Frosted-white segmented pill switcher (`Side A`, `Side B`, `All Tracks`, `Lyrics`) with sliding `#FFFFFF` active pill highlight.
* **Right Controls:**
  1. **`Reconnect Folder` Pill (Conditional):** Amber-tinted frosted pill appearing when a stored `FileSystemDirectoryHandle` needs permission re-authorization (`await handle.queryPermission({ mode: 'read' }) !== 'granted'`).
  2. **`+ Files` Solid Ink Pill (`#141413`):** Triggers `<input type="file" accept=".mp3,.flac,.lrc,audio/mpeg,audio/flac" multiple>` (never put `webkitdirectory` on this input so iOS Safari file selection always works).
  3. **`+ Folder` Secondary Frosted Pill ($\ge 768\text{px}$ desktop only):** Uses `window.showDirectoryPicker()` when `window.isSecureContext && typeof window.showDirectoryPicker === 'function'` is supported, falling back to `<input type="file" webkitdirectory directory multiple>` on other desktop browsers.
  4. **Icon Buttons ($36\text{px}\text{–}38\text{px}$ circular `#FFFFFF` chips with `aria-label`):**
     * **Floating Mini-Deck Pop-Out** (`Document Picture-in-Picture` or draggable in-page portal mini-deck).
     * **Quick-Jump Search & Filter (`/` or `Cmd/Ctrl + K`):** Opens `SearchModal` with live query input and filter chips (`All`, `Lossless FLAC`, `Chill <95 BPM`, `Upbeat >120 BPM`).
     * **Audio Rack / EQ Sliders:** Opens `AudioRackDrawer` (`createPortal` + `AnimatePresence`) with **10-Band EQ**, Output/Gear Profile selector, `ReplayGain` + **`+6 dB` Pre-Amp Make-Up** toggles, **Platter Lock** toggle, `IndexedDB` cache meter, and **`Clear Library`**.

### B. Left Panel — Floating Frosted Tracklist Card (`TrackListPanel.tsx`)
* **Card Container:** Frosted white card (`rgba(255,255,255,0.86)`, `blur(18px)`, `border-radius: 24px`), crowned with a subtle blueprint label (`❖ VINYL PRESSING • QUEUE` in `JetBrains Mono` `10px`, `#2563EB`).
* **Album Grouping, Multi-Disc Pagination & 3D Side Flip:**
  * Groups tracks by normalized `Album Title` (showing `"Various Artists"` when artist tags differ across an album, or `"Single Pressings"` if untagged), sorted by `trackNumber` with natural numeric filename fallback (`localeCompare(..., { numeric: true })`).
  * Paginates into **`Disc 1` / `Disc 2`...** when $> 8$ tracks, with **`Side A`** ($1\text{–}4$), **`Side B`** ($5\text{–}8$), and **`All`** tabs inside a scrollable container (`padding-bottom: calc(124px + env(safe-area-inset-bottom))`).
  * Clicking between `Side A` and `Side B` (or manually selecting a track on the opposite side) triggers a $500\text{ms}$ CSS `rotateY(180deg)` 3D platter flip; natural track-to-track progression advances gaplessly.
* **Unified Cross-Side `@dnd-kit/sortable` Reordering, `"Re-link"` Recovery & Studio Frame:**
  * Wrap all visible disc tracks in a **single unified `<SortableContext>`** (rendering `A side` and `B side` editorial serif headings as visual dividers in `All` view so dragging between sides never snaps back). Bind `PointerSensor` (`distance: 6`), `TouchSensor` (`delay: 140, tolerance: 6`), and `KeyboardSensor` to a `⋮⋮` drag handle (`touch-action: none` on the handle only). Show an **`Up Next`** badge when Shuffle is active.
  * **Unbacked Track `"Re-link"` Pill:** If a track restored from `IndexedDB` exceeded the $250\text{ MB}$ blob cache cap and lacks an active `File`/`FileSystemFileHandle` (`track.needsRelink === true`), display an amber **`Re-link`** badge; clicking the row opens a single-file `<input type="file" accept=".mp3,.flac,audio/*">` picker to re-attach the file and start playback immediately.
  * **Gliding `motion/react` Studio Selection Frame:** Highlight the active track row on an elevated `#FFFFFF` card (`border-radius: 14px`) framed by `<motion.div layoutId="active-track-studio-frame">` (`1.5px solid var(--studio-blue)` + 4 corner anchor squares), with **`pointer-events: none`** on all decorative selection elements and inset bounds so `< 768px` mobile screens never overflow horizontally.
  * **Delete Song Button:** Far-right `✕` button ($44\text{px} \times 44\text{px}$ touch hit target) removes the track, revokes its Blob URLs, and shows a $4\text{-second}$ portal **`Undo`** toast.

### C. Centerpiece — Sculptural Plinth & 12-Inch Obsidian Vinyl Turntable (`VinylTurntable.tsx` + `useTurntablePhysics.ts`)
* **Hitbox Discipline:** `pointer-events: none` on `#turntableChassis`, the upper-right rotating circular typographic stamp seal (`ANALOG LISTENING ROOM • HIGH FIDELITY •`, $76\text{px}$ SVG text-path), and the tonearm SVG overlay; `pointer-events: auto` strictly on the circular vinyl disc (`border-radius: 50%`) and center label.
* **Sculptural White Plinth & Speed / Telemetry Controls:** Circular machined `#FFFFFF` plinth ringed by subtle `var(--accent-dynamic)` strobe dots housing `<motion.div layoutId="neplaylist-platter-morph" style={{ borderRadius: 9999 }}>`. Directly underneath sits a frosted segmented platter speed switch (**`BPM`** | **`33⅓`** | **`45`**) and a `#2563EB` studio telemetry pill (`118 BPM • 33⅓ RPM • FLAC`).
* **BPM-Driven Rotation & Cross-Browser Inertia:**
  * Angular velocity $\omega = \omega_{\text{base}} \times r_{\text{pitch}}\;\text{deg/sec}$ (`BPM Sync` scaled to clamped BPM, fixed $33\frac{1}{3}\text{ RPM} = 200\text{ deg/sec}$, or $45\text{ RPM} = 270\text{ deg/sec}$) updated via a `requestAnimationFrame` delta-time ref accumulator (mutating CSS `transform: rotate(${angle}deg)` directly without $60\text{fps}$ React re-renders) with $\approx 350\text{ms}$ motor spin-up/brake smoothing, `audio.preservesPitch = false`, and `audio.playbackRate` clamped to $[0.65, 1.08]$ during ramps so Safari/Firefox never hard-mute.
  * **Stationary Studio Sheen:** Non-rotating `conic-gradient` overhead reflection (`mix-blend-mode: screen`) above the spinning micro-grooves.
  * **Dynamic Center Label:** Circular $34\%$ cover label with white paper ring, `var(--accent-dynamic)` inner glow, BPM micro-stamp, and spindle pin; clicking toggles Play/Pause.
* **Touch-Safe Dual-Gesture Platter Interaction:** `touch-action: pan-y` on outer wrapper + **`> 8px` rotational arc threshold** before engaging scratch drag (plus **Platter Lock** support). Quick tap ($\le 8\text{px}$) performs a radial needle-drop ($r = 92\% \rightarrow 0\%$ to $r = 38\% \rightarrow 100\%$) with a brief, clean $45\text{ms}$ damped low-frequency ($90\text{Hz} \rightarrow 40\text{Hz}$) sine stylus-touch thump (zero static/noise); rotational drag ($> 8\text{px}$) scrubs `audio.currentTime` proportionally to $\Delta\theta$.
* **Tracking S-Shaped Chrome Tonearm:** Anchored at `transform-origin: 78% 8%`, resting at $-18^\circ$ when paused and tracking smoothly from $2^\circ$ to $14^\circ$ across the record during playback.

### D. Right Panel — Fanned Album Sleeve Deck & Output Console (`AlbumShowcasePanel.tsx` + `useOutputDevice.ts`)
* **Spring-Animated Fanned Album Sleeves:** Overlapping rounded-square `<motion.button>` sleeves (`border-radius: 20px`, `2px solid #FFFFFF` border, alternating spring tilts $-6^\circ, -3^\circ, 0^\circ, +3^\circ, +6^\circ$, `whileHover={{ y: -8, rotate: 0 }}`) inside a horizontal track with **`pt-9 pb-4 px-4`** vertical headroom so `@${artistHandle}` speech-bubble badges (`background: var(--accent-dynamic)`, `color: var(--accent-dynamic-ink)`) and rotated sleeve corners never clip under `overflow-x: auto`.
* **Album Telemetry & Clip LED:** Centered `Plus Jakarta Sans` `700` album title, album counter (`1 / 3`), `Artist • Year`, `JetBrains Mono` lossless stream badge (`FLAC • 24-BIT / 96kHz`) with an amber (`#F59E0B`) $0\text{ dBFS}$ peak-clipping micro-LED, and 2-line liner notes.
* **Cross-Platform Output Hardware Pill & Quartz Pitch (`useOutputDevice.ts`):**
  * Frosted `#FFFFFF` pill showing an adaptive hardware icon, pulsing `var(--accent-on-light)` dot, `OUTPUT` micro-label, and live device name (stripping OS boilerplate like `"Default - Moondrop Edge (Bluetooth)"` $\rightarrow$ **`Moondrop Edge`**). Guard `navigator.mediaDevices?.enumerateDevices` with optional chaining + `window.isSecureContext`; use `setSinkId()` on supported desktop browsers (resetting to `""` system default if a Bluetooth headset disconnects on `devicechange`) and an **OS Route & Saved Gear Profile** selector on mobile/Safari/Firefox via `createPortal(..., document.body)`.
  * Compact **Quartz Pitch Fader (**$\pm 8\%$**)** micro-pill with double-click reset to `0.0%`.
* **Dual-Pill CTAs & Crash-Proof Studio Card Export (`ArtworkLyricsModal.tsx`):**
  * **`See Artwork`** (solid `#141413` pill) + **`Synced Lyrics`** (frosted `#FFFFFF` pill) open `ArtworkLyricsModal` (`L` shortcut, `createPortal` + `AnimatePresence`), featuring full-res artwork, synchronized `Instrument Serif` lyrics (click-to-seek + $-0.2\text{s} / +0.2\text{s}$ Bluetooth sync offset), and an **`Export Studio Card (PNG)`** button.
  * **Crash-Proof PNG Export Rule:** Before calling `ctx.drawImage(img, ...)` on the $1080 \times 1350$ export canvas, load a dedicated `Image`, `await img.decode()` inside `try/catch`, and verify `img.complete && img.naturalWidth > 0`; if `track.fullArtUrl` is `null` (such as on the procedural demo track) or decoding fails, render a crisp **vector gallery-art vinyl sleeve + spinning obsidian disc illustration** onto the canvas so export never throws `InvalidStateError`.

### E. Bottom Centered Floating Glass Studio Transport Dock (`BottomTransportDock.tsx`)
Centered floating frosted-white dock hovering `14px + env(safe-area-inset-bottom)` above the viewport bottom (`width: min(940px, calc(100vw - 24px))`, `min-height: 62px`, `border-radius: 22px`, `background: rgba(255, 255, 255, 0.90)`, `backdrop-filter: blur(22px)`):
1. **Left Transport Cluster:** Smart **Back** (`|◀`, restarts if `> 3s`, else previous track), solid `#141413` **Play/Pause** ($40\text{px}$ circle), **Skip** (`▶|`), **Shuffle**, **Repeat Cycler** (`Off` $\rightarrow$ `Always Repeat` $\rightarrow$ `Repeat One`), and **`A–B` Phrase Loop** pill (`Set A` $\rightarrow$ `Set B (Looping)` $\rightarrow$ `Clear`).
2. **Center `audiomotion-analyzer` Logarithmic Visualizer & Continuous Scrubber:**
   * Elapsed `JetBrains Mono` timestamp, `AudioMotionAnalyzer` container (`min-height: 36px`, `touch-action: none`), and total duration (`--:--` until VBR metadata resolves).
   * **`StrictMode`-Safe Lazy Initialization:** Instantiate `AudioMotionAnalyzer` (`connectSpeakers: false`, `overlay: true`, `showBgColor: false`, `showScaleX: false`, `showScaleY: false`, `showPeaks: false`, `mode: 6`, `barSpace: 0.35`, `smoothing: 0.72`) once `AudioContext` initializes on user gesture, clear `container.innerHTML = ''` beforehand, and call `analyzer.destroy()` in `useEffect` cleanup so React `StrictMode` never stacks two `<canvas>` elements. Tint played bars up to progress percentage in **`var(--accent-on-light)`** and unplayed bars in **`#D6D3CD`**, with a CSS bar-pulse fallback if iOS Safari outputs zero FFT data.
   * Guard pointer scrubbing with `Number.isFinite(duration) && duration > 0`, rendering a floating `#141413` `JetBrains Mono` timestamp pill via `createPortal(..., document.body)` $36\text{px}$ above the pointer while dragging.
3. **Right Motor Power Toggle:** Separated by a $1\text{px}$ hairline divider: circular **`ON` / `OFF`** motor power button ($36\text{px}$) with a `var(--accent-on-light)` status ring.

---

## 5. Production-Grade Engine & Safeguard Rules

1. **React `StrictMode` Singleton & Monotonic `loadGenerationId` (`audioEngine.ts`):** Keep `AudioEngine` as a module singleton outside React render lifecycles so `createMediaElementSource(audio)` is called once. Increment `loadGenerationId` on every track/album switch and abort any stale async callback (`audio.play()`, BPM detection, color extraction, `.lrc` parse) if `gen !== loadGenerationId`, catching `AbortError` cleanly.
2. **Pure Static-Free Procedural Boot Track (`demo_warm_analog_01`):** Initialize with 1 lightweight pure musical chord loop (`title: "Midnight Pressing (Studio Loop)"`, `artist: "NEPlaylist Studio"`, `album: "Analog Calibration"`, `year: "2026"`, `duration: 180`, `bpm: 116`, `codecLabel: "WEB AUDIO • 32-BIT FLOAT"`, inline SVG cover, 4 sample timed lyrics) synthesized via warm low-pass filtered triangle/sine harmonic oscillators—**zero white/pink noise buffers**.
3. **Streaming `music-metadata`, VBR Backfill & Per-Track `Blob` Lifecycle (`metadataParser.ts` + `storage.ts`):**
   * Run a max-$3$ concurrency queue using `parseBlob(file, { skipPostHeaders: true })` (no Node `Buffer` polyfill). Backfill missing VBR `.mp3` durations from `<audio>` `loadedmetadata`.
   * Downscale cover images to $600 \times 600$ thumbnails while keeping full-res `Blob` URLs cached per track in memory—**do NOT revoke cover `Blob` URLs on track switch** (revoke only when a track is deleted or `Clear Library` is clicked) so `colorthief` and PNG Studio Card exports never hit revoked URLs.
   * Assign deterministic content-signature IDs (`${normTitle}_${normAlbum}_${Math.round(duration || 0)}_${fileSize}`). Keep `localStorage` under $50\text{ KB}$ for scalar resume/EQ/gear settings; store track metadata, custom orders, directory handles, and uploaded `File` blobs (up to a $250\text{ MB}$ cache budget) in `idb-keyval`, flagging restored unbacked tracks with `needsRelink: true`.
4. **Safe-Window Beat Detection (`web-audio-beat-detector`):** Skip auto-BPM decoding if `file.size > 35_000_000` ($35\text{ MB}$) and no embedded BPM tag exists (defaulting smoothly to $110\text{ BPM}$). Otherwise slice a leading audio segment via `OfflineAudioContext`, guard `audioBuffer.duration >= 2`, compute `const offset = Math.min(15, audioBuffer.duration * 0.2); const duration = Math.min(15, Math.max(1, audioBuffer.duration - offset));`, call `analyze(audioBuffer, offset, duration, { minTempo: 60, maxTempo: 165 })` so short intros never throw bounds errors and slow ballads are never double-timed, and release the temporary `AudioBuffer` immediately.
5. **Native Sample-Rate DSP, `NaN`-Safe `ReplayGain` & iOS Recovery (`audioEngine.ts`):** Lazy-init `new AudioContext()` at hardware-native sample rate, recovering from `'suspended' | 'interrupted'` via `onstatechange` and `visibilitychange`. Route `Source -> ReplayGainNode -> 10-Band EQ ([31..16000 Hz], Q=1.4) -> Safety Limiter (DynamicsCompressorNode, threshold: -1, ratio: 12) -> AnalyserNode -> Destination`, with presets **Reference Flat** (`[0,0,0,0,0,0,0,0,0,0]`), **Warm Vinyl** (`[3.5,2.5,1.5,0.5,0,-0.5,-1,-1.5,-2.5,-3.5]`), **Vocal Clarity** (`[-1.5,-1,0,1,2.5,3.5,3,1.5,0.5,0]`), and **Sub-Bass** (`[6,4.5,2.5,0.5,0,0,0,0.5,1,1.5]`). Normalize comma decimals in `ReplayGain` tags, clamp to $[-18, +12]\text{ dB}$, and verify `Number.isFinite()` before updating `gain.value`.
6. **Null-Safe `colorthief` v3 Extraction (`colorExtractor.ts`):** Await `img.decode()` (`img.complete && img.naturalWidth > 0`), call `const palette = getPaletteSync(img, { colorCount: 6 })` inside `try/catch`, **guard `Array.isArray(palette) && palette.length > 0`** (since `colorthief` v3 returns `Color[] | null`), normalize v3 `Color` instances via `.hsl()` (or RGB array fallback + offscreen `<canvas>` fallback), default achromatic covers ($S < 42\%$) to `#E04F3E`, and emit `--accent-dynamic`, `--accent-dynamic-ink`, and `--accent-on-light` ($L \le 42\%$).
7. **Input-Safe Keyboard Shortcuts & `MediaSession`:** Bind `Space` (Play/Pause), `ArrowLeft/Right` ($\pm 5\text{s}$), `Shift + ArrowLeft/Right` ($\pm 1\text{s}$), `Alt + ArrowLeft/Right` (Prev/Next), `L` (Lyrics/Artwork modal), `/` or `Cmd/Ctrl + K` (Search modal), and `Esc` (close modals), **ignoring all shortcuts when `e.isComposing` is true or `e.target` / `document.activeElement` is an `<input>`, `<textarea>`, `<select>`, or `[contenteditable="true"]`**.

---

## 6. Subagent Orchestration & Shared Interface Contract

When orchestrating with parallel or sequential AI subagents, share `src/types/neplaylist.ts` across **4 specialized subagents**:

```ts
export interface LyricLine {
  timeSec: number | null;
  text: string;
}

export interface TrackRecord {
  id: string;                  // Deterministic: `${normTitle}_${normAlbum}_${Math.round(duration || 0)}_${fileSize}`
  title: string;
  artist: string;
  album: string;
  year: string;
  trackNumber: number;
  duration: number;            // Seconds (backfilled via loadedmetadata if VBR)
  bpm: number;                 // Embedded or detected BPM (default 110)
  codecLabel: string;          // e.g., "FLAC • 24-BIT / 96kHz"
  replayGainDb: number | null; // Clamped [-18, +12] dB or null
  thumbUrl: string | null;     // 600x600 Blob Object URL or inline SVG data URL
  fullArtUrl: string | null;   // Full-res Blob Object URL (retained until track deleted)
  lyrics: LyricLine[];
  sourceType: 'demo' | 'blob' | 'fs-handle';
  needsRelink?: boolean;
  file?: File;
  fileHandle?: FileSystemFileHandle;
}

export interface PlayerState {
  loadGenerationId: number;
  albums: Record<string, TrackRecord[]>;
  activeAlbumKey: string;
  activeDisc: number;
  sideFilter: 'A' | 'B' | 'all';
  activeTrackId: string;
  isPlaying: boolean;
  motorPowered: boolean;
  platterLocked: boolean;
  driveMode: 'bpm' | '33' | '45';
  pitchPercent: number;        // -8.0 to +8.0
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  abLoop: { aSec: number | null; bSec: number | null };
  replayGainEnabled: boolean;
  preampBoostDb: 0 | 6;
  lyricOffsetSec: number;
  accentHex: string;
  accentInkHex: string;
  accentOnLightHex: string;
}
```

1. **Subagent 1 — Gallery UI, `motion/react` Morphs & Turntable Physics:** Owns `src/index.css`, `src/hooks/useTurntablePhysics.ts`, `BootPreloader.tsx`, `Header.tsx`, `TrackListPanel.tsx`, `VinylTurntable.tsx`, `AlbumShowcasePanel.tsx`, `BottomTransportDock.tsx`, `FloatingMiniDeck.tsx`. Enforces single-row `< 640px` icon-chip header compaction, portrait mobile above-the-fold platter priority (`min(256px, 66vw, 38dvh)`), `pointer-events-none` on exiting `BootPreloader`, unified cross-side `@dnd-kit/sortable` context, `Re-link` recovery badge, `pt-9 pb-4` sleeve headroom, `padding-bottom: calc(124px + env(safe-area-inset-bottom))`, and `StrictMode`-safe `AudioMotionAnalyzer` cleanup.
2. **Subagent 2 — Streaming Metadata, Null-Safe `colorthief` v3 & `idb-keyval` Persistence:** Owns `package.json`, `vite.config.ts`, `src/types/neplaylist.ts`, `metadataParser.ts`, `colorExtractor.ts`, `lrcParser.ts`, `storage.ts`. Enforces `parseBlob` without Node `Buffer` polyfills, per-track `Blob` URL retention until deletion, null-safe `getPaletteSync` v3 `.hsl()` normalization, dual `--accent-dynamic` / `--accent-on-light` tokens, and $250\text{ MB}$ `IndexedDB` blob caching with `needsRelink` flagging.
3. **Subagent 3 — Pure Web Audio DSP, Safe-Window Beat Detector & Studio Modals:** Owns `audioEngine.ts`, `useOutputDevice.ts`, `AudioRackDrawer.tsx`, `ArtworkLyricsModal.tsx`, `SearchModal.tsx`. Enforces zero static/noise buffers, `loadedmetadata` VBR duration backfill, clamped `web-audio-beat-detector` slices (`{ minTempo: 60, maxTempo: 165 }`, $\le 35\text{ MB}$), `NaN`-safe `ReplayGain`, `setSinkId` hot-unplug fallback, and `img.decode()`-gated PNG Studio Card export with vector vinyl fallback.
4. **Subagent 4 — App Orchestrator & Cross-Device QA Auditor:** Owns `src/App.tsx`, `src/main.tsx`, `index.html`, `tailwind.config.js`. Places `<AnimatePresence>` outside `{isBooting && <BootPreloader />}` inside `<MotionConfig reducedMotion="user">`, guards global shortcuts against active form inputs/`isComposing`, and verifies `npm run build` plus Section 7 across desktop ($1366 \times 768$) and mobile ($360 \times 800$, $390 \times 844$) viewports.

---

## 7. Acceptance Criteria Checklist

1. **Clean Build & Pure Static-Free Audio:** `npm install && npm run build` passes with zero TypeScript, `Buffer` polyfill, or `colorthief` errors, and default boot playback emits pure harmonic chords with zero radio static or noise buffers.
2. **Smooth `motion/react` Pre-Loader & Interactive Turntable:** `<AnimatePresence>` wraps outside `{isBooting && <BootPreloader />}`, `pointer-events-none` applies immediately on exit, `layoutId="neplaylist-platter-morph"` glides onto `#turntableChassis` within $1500\text{ms}$, and the platter supports `BPM` / `33⅓` / `45` modes, Quartz Pitch ($\pm 8\%$), and `> 8px` threshold touch scrubbing.
3. **Mobile Fold Priority & Narrow-Phone Responsiveness:** Below `640px`, header secondary controls collapse into `36px × 36px` icon chips on one row; below `768px`, the compact vinyl platter (`min(256px, 66vw, 38dvh)`) renders above the fold ahead of the fanned sleeves and tracklist, and scrollable lists clear the floating bottom dock (`calc(124px + env(safe-area-inset-bottom))`).
4. **Input-Safe Shortcuts, `StrictMode`-Safe Spectrum & Crash-Proof Export:** Global shortcuts ignore active `<input>`/`<textarea>` typing; `AudioMotionAnalyzer` destroys cleanly on unmount with zero duplicate canvases; `SearchModal` includes quick filter chips; `BottomTransportDock` supports `A–B` looping; and `ArtworkLyricsModal` exports a $1080 \times 1350$ PNG Studio Card cleanly even on the demo track.
5. **Streaming Ingestion & Resilient Persistence:** `music-metadata` `parseBlob` + `loadedmetadata` backfill handles VBR `.mp3` and `.flac` files without RAM spikes; `web-audio-beat-detector` clamps short tracks safely; `colorthief` guards `null` palettes and retains cover `Blob` URLs until track deletion; and `idb-keyval` flags unbacked restored tracks with `needsRelink: true` (`Re-link` pill).