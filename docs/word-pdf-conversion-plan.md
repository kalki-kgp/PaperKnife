# Plan: Word ⇄ PDF Conversion

> Status: **Phase 1 & 2 shipped** (live at `paperknife.app/word-to-pdf`).
> Phase 3 (PDF → Word) deliberately **deferred** — see rationale below.
> Origin: user feature request (`paperknife.app/feedback`) for "word to pdf and
> vice-versa (not just extracting text)".
>
> - **Phase 1 ✅** Word → PDF, rasterized (faithful look). `WordToPdfTool.tsx`
>   via `docx-preview` + `html2canvas` + `pdf-lib`.
> - **Phase 2 ✅** Selectable-text (vector) mode toggle. `docxToPdfVector.ts`
>   via `mammoth` → pdf-lib text layout: headings, bold/italic, underline,
>   strikethrough, links, ordered/nested lists, images, basic tables (bold +
>   shaded headers), word wrapping, pagination.
> - **Phase 3 ⏸ deferred** PDF → Word stays "not yet" over "bad": a client-side
>   converter is inherently low-fidelity and the biggest reputational risk.

## Goal

Let users convert between Word (`.docx`) and PDF **entirely client-side**, with no
uploads — consistent with PaperKnife's privacy-first promise. The hard constraint
(no server) is what shapes — and limits — this plan.

## The two directions are NOT equal

| Direction | Feasibility (client-side) | Quality ceiling |
|-----------|---------------------------|-----------------|
| **Word → PDF** | Reasonable | Good for typical docs; imperfect on complex layout |
| **PDF → Word (`.docx`)** | Hard / low-fidelity | Poor without a server; structural reconstruction |

### Why PDF → Word is the hard one

A PDF stores positioned glyphs, not document structure (paragraphs, styles,
tables). Producing a genuinely editable `.docx` means *reconstructing* that
structure from coordinates — the same fundamental problem as true in-place text
editing. Tools that do this well run **LibreOffice/headless Office on a server**,
which would break our no-upload invariant. Client-side output is rough (broken
flow, lost styling, mangled tables).

**Decision:** ship **Word → PDF first**. Treat PDF → Word as either (a) deferred,
or (b) shipped only with an explicit "best-effort, low-fidelity, layout may not be
preserved" warning. Do **not** silently send files to a server to make it "work."

## Word → PDF: approach

Fully in-browser pipeline, no new network calls:

1. **Parse `.docx`** → HTML. Candidate libs:
   - `mammoth` (`mammoth.js`) — clean semantic HTML, good for text/headings/lists,
     limited on complex layout.
   - `docx-preview` — higher visual fidelity (renders closer to Word's layout).
2. **Render HTML → PDF.** Options:
   - `html2canvas` → image → `pdf-lib` (rasterized; simplest, but text becomes
     non-selectable and files get larger).
   - A DOM-to-vector path (e.g. `html2pdf`/`jspdf` html mode) for selectable text
     where layout allows.
3. **Output** Blob + object URL, reusing `SuccessState` + `recentActivity`.

Trade-off to decide during build: **rasterized (faithful look, no text layer)**
vs **vector (selectable text, weaker layout fidelity)**. Likely offer rasterized
as the safe default.

### Known limitations to state honestly in UI/SEO copy

- Complex tables, multi-column layouts, headers/footers, and embedded fonts may
  not match Word exactly.
- Track-changes, comments, and macros are out of scope.
- This is conversion, not a Word editor.

## Architecture fit

- New tool `src/components/tools/WordToPdfTool.tsx` (lazy-loaded), registered in
  the `tools` array in `App.tsx` + a `<Route>`.
- Reuse `NativeToolLayout`, `SuccessState`, `ToolSeoContent`, `usePipeline`.
- New dependency: `mammoth` and/or `docx-preview` (+ an HTML→PDF lib if not
  rasterizing via existing canvas paths). Keep them in the tool's lazy chunk so
  the main bundle is unaffected (CLAUDE.md: heavy tools stay lazy-loaded).
- **Privacy invariant:** parsing + rendering happen in-browser only; no file bytes
  leave the device.

## Phases

- **Phase 1 ✅ (shipped):** Word → PDF, rasterized, single output.
- **Phase 2 ✅ (shipped):** Vector/selectable-text mode via a `mammoth` →
  pdf-lib layout engine, offered as a toggle alongside the raster path.
- **Phase 3 ⏸ (deferred):** PDF → Word (`.docx`). Re-evaluated after Phase 1 and
  held: client-side output can't clear a usefulness bar without a server, so we
  keep it "not yet" rather than ship a broken-looking feature.

## Risks / open questions

- **Bundle size:** `.docx` parsers + HTML→PDF are non-trivial; must stay lazy.
- **Fidelity expectations:** users compare against Microsoft/Google output; set
  expectations in copy to avoid "it looks wrong" feedback.
- **PDF → Word honesty:** the biggest reputational risk is shipping a bad
  PDF→Word and having it look like a broken feature. Prefer "not yet" over "bad."

## Acceptance criteria (Phase 1)

- [x] Upload a `.docx`, preview/convert, download a PDF — all on-device.
- [x] Typical text document (headings, paragraphs, lists, basic images) renders
      legibly and close to source.
- [x] Zero network requests carrying user file content.
- [x] Lazy-loaded; `bun run lint` clean; `bun run build` passes.
