# Plan: Word ⇄ PDF Conversion

> Status: **Proposal / not implemented.** This document is the plan only.
> Origin: user feature request (`paperknife.app/feedback`) for "word to pdf and
> vice-versa (not just extracting text)".

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

- **Phase 1:** Word → PDF, rasterized, single output. Smallest useful slice.
- **Phase 2:** Vector/selectable-text mode where layout permits; quality tuning.
- **Phase 3:** PDF → Word (`.docx`) as explicit best-effort/low-fidelity, or drop
  if quality can't clear a usefulness bar client-side. Re-evaluate after Phase 1.

## Risks / open questions

- **Bundle size:** `.docx` parsers + HTML→PDF are non-trivial; must stay lazy.
- **Fidelity expectations:** users compare against Microsoft/Google output; set
  expectations in copy to avoid "it looks wrong" feedback.
- **PDF → Word honesty:** the biggest reputational risk is shipping a bad
  PDF→Word and having it look like a broken feature. Prefer "not yet" over "bad."

## Acceptance criteria (Phase 1)

- [ ] Upload a `.docx`, preview/convert, download a PDF — all on-device.
- [ ] Typical text document (headings, paragraphs, lists, basic images) renders
      legibly and close to source.
- [ ] Zero network requests carrying user file content.
- [ ] Lazy-loaded; `bun run lint` clean; `bun run build` passes.
