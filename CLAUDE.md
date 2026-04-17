# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project

**PaperKnife** — a privacy-first PDF utility that runs entirely in the browser. No uploads, no servers, no tracking. Ships as a web app (PWA) and an Android app via Capacitor.

Stack: React 18 + TypeScript + Vite + Tailwind CSS. PDF work uses `pdf-lib` and `pdfjs-dist`; OCR uses `tesseract.js`; drag-and-drop uses `@dnd-kit/*`.

## Commands

Prefer `bun` (lockfile is `bun.lock`); `npm` works too.

```bash
bun install              # install deps
bun run dev              # vite dev server
bun run build            # type-check (tsc) then vite build -> dist/
bun run lint             # eslint (max-warnings 0)
bun run preview          # preview production build
```

Env vars:
- `VITE_BASE` — asset base path (default `/`; use `./` for GitHub Pages).
- `VITE_DISABLE_OCR` — set `true` to strip the PDF-to-Text tool and shrink the bundle.

## Architecture

- Entry: `src/main.tsx` → `src/App.tsx`.
- `App.tsx` owns routing, global drop handling, the QuickDrop modal, auto-wipe logic, and chooses `BrowserRouter` (web) vs `HashRouter` (native, via `Capacitor.isNativePlatform()`).
- View shell: `src/components/Layout.tsx`. Two top-level views:
  - `WebView.tsx` — desktop/web experience.
  - `AndroidView.tsx` + `AndroidToolsView.tsx` + `AndroidHistoryView.tsx` — native/mobile experience.
- Tools live in `src/components/tools/*Tool.tsx`, each lazy-loaded in `App.tsx` so heavy deps (`pdf-lib`, `pdfjs-dist`, `tesseract.js`) are fetched on demand. Shared tool UI is in `src/components/tools/shared/`.
- Tool registry: the `tools` array in `App.tsx` is the source of truth for titles, icons, paths, categories, and colors. When adding a tool, update this array and add a `<Route>` below.
- Cross-cutting state via React contexts in `src/utils/`:
  - `pipelineContext.tsx` — the active file passed between tools (QuickDrop → tool route).
  - `viewModeContext.tsx` — web vs android view mode.
- PDF helpers: `src/utils/pdfHelpers.ts`, `src/utils/pdfWorker.ts` (pdfjs worker setup).
- Persistence and privacy: `workspacePersistence.ts`, `recentActivity.ts` (auto-wipe timer driven by `localStorage.autoWipe` + `autoWipeTimer`), `offlineStatus.ts`, `offlineWarmup.ts`.
- Android integration uses `@capacitor/*`. `fileIntent` window events deliver "Open with" / "Share to" files; Capacitor `Filesystem` reads them.
- Types: `src/types.ts`.

## Routing notes

- Web uses `BrowserRouter` so direct URLs like `/merge` must fall back to `index.html` on the server (see README for nginx / serve / Docker examples).
- Native builds use `HashRouter` automatically.
- Unknown routes redirect to `/` via the catch-all `Navigate`.

## Conventions

- TypeScript strict, ESLint with `--max-warnings 0` — keep the tree clean.
- Tailwind for styling; brand accent is `terracotta-*` (see `tailwind.config.js`). Light mode is currently forced in `App.tsx` (`classList.remove('dark')`), but dark variants are present throughout the components.
- Icons: `lucide-react`.
- Toasts: `sonner` (`<Toaster />` is mounted once in `App.tsx`).
- Keep new heavy tools lazy-loaded (`lazy(() => import(...))`) and wrap their routes in the existing `<Suspense>` boundary.
- Preserve the AGPL-3.0 license header present at the top of source files when creating new top-level files.
- Privacy is the product — never introduce network calls that send user files or content off-device.

## Android / Capacitor

- Not building Android APKs anymore.

## House rules

- Do not create docs/`.md` files unless asked.
- Do not add narrating comments; only comment non-obvious intent.
- Match existing file conventions before introducing new patterns.
