# Plan: `EditTool` — In-Browser PDF Annotation & Form-Fill Editor

> Status: **Proposal / not implemented.** This document is the plan only.
> Origin: user feature request (`paperknife.app/feedback`) for an "Edit PDF" tool.

## Goal

Add a single **Edit PDF** tool that lets users overlay content on a PDF and fill
existing form fields — entirely client-side, no uploads — consistent with
PaperKnife's privacy-first promise.

Scope is deliberately framed as an **overlay/annotation editor + form filler**,
not a word-processor-style reflow editor (see Non-Goals).

## What users actually mean by "Edit PDF"

The request bundles five distinct asks with very different difficulty:

| Capability                         | Feasibility | Approach |
|------------------------------------|-------------|----------|
| Add text boxes                     | Easy        | `pdf-lib` `drawText` + embedded font |
| Add images / signatures            | Done today  | Reuse `SignatureTool` machinery |
| Highlights / shapes / freehand     | Moderate    | Canvas overlay → flatten as rect/path/image |
| Fill existing form fields (AcroForm) | Moderate  | `pdf-lib` `getForm()` → `setText()` → flatten |
| Delete / cover existing content    | Moderate    | Opaque "redaction" box (cover, not true removal) |
| Edit *existing* body text in place | **Out of scope** | Not viable client-side (see Non-Goals) |

## Non-Goals (v1)

- **True in-place editing of existing text.** PDFs store positioned glyphs, not
  editable paragraphs; there is no reflow, and `pdf-lib` cannot rewrite existing
  content streams. The realistic substitute is *cover-and-retype* (redaction box
  + new text on top), which we expose via the cover + text-box tools rather than
  pretending to edit the original run.
- True content-stream object deletion.
- OCR-to-editable-text (the existing OCR path stays in `PdfToTextTool`).

## Architecture fit

Reuses existing patterns — no new heavy dependencies.

- **Render:** `pdfjs-dist` via `renderPageThumbnail` / page canvas
  (`src/utils/pdfHelpers.ts`), same as `SignatureTool`.
- **Position model:** percentage-based overlay coords → PDF coords, exactly the
  `pos.x/100 * width` mapping already in `SignatureTool.tsx`.
- **Write:** `pdf-lib` `drawText` / `drawImage` / `drawRectangle` /
  `drawSvgPath`, then `save()` to a Blob + object URL.
- **Forms:** `pdf-lib` `PDFDocument.getForm()` (already a transitive capability).
- **Lazy-load:** new route registered in the `tools` array in `App.tsx`, wrapped
  in the existing `<Suspense>` boundary (per CLAUDE.md conventions).
- **Shared UI:** `NativeToolLayout`, `SuccessState`, `ToolSeoContent`,
  `usePipeline` (QuickDrop intake) — all reused.

## Proposed UX

A single canvas editor with a left/bottom toolbar of element types:

1. **Text** — click to drop a text box; type; drag to position; size/color/font.
2. **Image / Signature** — upload, drag, resize (reuse existing signature flow).
3. **Highlight** — drag a translucent rectangle over text.
4. **Box / Cover** — opaque rectangle (white or chosen color) to redact/hide.
5. **Shape / Freehand** — pen capture on an overlay canvas, flattened on export.
6. **Form Fill** — if the PDF has AcroForm fields, render them as editable inputs
   and write values back; otherwise hide this mode.

Elements live in React state as a list of `{ id, type, page, x, y, w, h, ... }`,
rendered as draggable overlays on the page preview, then **flattened** into the
PDF on export. Multi-page: a page selector reusing the rearrange/preview pattern.

## Implementation phases

- **Phase 1 (ship first):** Add-text + Image/Signature + Cover box, single page.
  Smallest useful slice; covers the most common "edit" need.
- **Phase 2:** Highlights, shapes, freehand annotation; multi-page navigation.
- **Phase 3:** AcroForm form-filling (detect fields, edit, flatten).
- **Phase 4:** Polish — undo/redo (state stack), per-element delete, font picker,
  color picker, mobile touch parity (the `handleMouseMove`/touch pattern already
  exists in `SignatureTool`).

## Files to add / touch

- `src/components/tools/EditTool.tsx` — new tool (lazy-loaded).
- `src/App.tsx` — register in `tools` array + add `<Route>`.
- `src/utils/pdfHelpers.ts` — possible shared helpers for overlay→PDF coord math
  and AcroForm detection (extract from `SignatureTool` if duplicated).
- SEO copy via `ToolSeoContent` (title, benefits, how-it-works, FAQs).

## Risks / notes

- **Font embedding:** custom fonts for added text increase output size; default to
  standard `pdf-lib` fonts, offer embed opt-in later.
- **Encrypted PDFs:** reuse the existing unlock flow (`unlockPdf`) before editing.
- **Privacy invariant:** no network calls touch user files — must hold (CLAUDE.md).
- **Honesty in copy:** SEO/FAQ text must not claim true text editing; describe it
  as annotation + overlay + form-fill to set correct expectations.

## Acceptance criteria (Phase 1)

- [ ] Load a PDF (incl. encrypted via unlock), preview page 1.
- [ ] Add a text box, position it, export; text appears at correct coords.
- [ ] Add an image/signature and a cover box; both flatten correctly.
- [ ] Output downloads locally; zero network requests with user content.
- [ ] Lazy-loaded; `bun run lint` clean; `bun run build` passes.
