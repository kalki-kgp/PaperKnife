"""
PaperKnife - The Swiss Army Knife for PDFs
Copyright (C) 2026 kalki-kgp

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

---

pdfcompare - a Python port of PaperKnife's Compare tool (src/utils/pdfDiff.ts).

Text mode : word-level diff with real glyph bounding boxes (PyMuPDF).
Visual mode: per-pixel diff of rendered pages (Pillow).
Output    : side-by-side annotated report PDF, same layout as the web tool.

Requires: pip install pymupdf pillow

    python3 pdfcompare.py original.pdf revised.pdf --mode text   -o diff.pdf
    python3 pdfcompare.py original.pdf revised.pdf --mode visual -o diff.pdf
"""

from __future__ import annotations

import argparse
import difflib
import io
import sys
from dataclasses import dataclass

import fitz  # PyMuPDF
from PIL import Image, ImageChops, ImageDraw

MAX_RENDER_EDGE = 1400
REPORT_MAX_EDGE = 900
GAP = 8

ADD = (52, 211, 153)
REMOVE = (248, 113, 113)
MODIFIED = (251, 191, 36)
PIXEL_DIFF = (230, 60, 60)


@dataclass
class WordBox:
    text: str
    x: float
    y: float
    w: float
    h: float


@dataclass
class Op:
    op: str  # equal | add | remove | modified
    a_index: int | None = None
    b_index: int | None = None
    text: str = ""


@dataclass
class PageTextDiff:
    ops: list[Op]
    words_a: list[WordBox]
    words_b: list[WordBox]
    added: int
    removed: int
    modified: int
    has_text: bool


def pick_shared_scale(page_a, page_b, max_long_edge=MAX_RENDER_EDGE):
    """Both sides render to the same pixel width so overlays and pixel diffs line up."""
    ref = page_a or page_b
    if ref is None:
        return 1.0, 1.0, 0, 0

    ra = page_a.rect if page_a else None
    rb = page_b.rect if page_b else None
    target_w = max(ra.width if ra else 0, rb.width if rb else 0)
    target_h = max(ra.height if ra else 0, rb.height if rb else 0)

    cap = max_long_edge / max(target_w, target_h, 1)
    zoom = min(1.5, cap)
    final_w = int(target_w * zoom + 0.999)
    final_h = int(target_h * zoom + 0.999)

    scale_a = final_w / ra.width if ra else 1.0
    scale_b = final_w / rb.width if rb else 1.0
    return scale_a, scale_b, final_w, final_h


def render_page(page, scale: float) -> Image.Image:
    """Opaque white-backed render, so pixel diffing isn't confused by alpha."""
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def extract_word_boxes(page, scale: float) -> list[WordBox]:
    """
    Real per-word boxes straight from MuPDF's text layer -- no proportional
    character-count estimate, which is where the JS version drifts.
    """
    out = []
    for x0, y0, x1, y1, text, *_ in page.get_text("words"):
        if not text.strip():
            continue
        out.append(WordBox(text, x0 * scale, y0 * scale,
                           (x1 - x0) * scale, (y1 - y0) * scale))
    return out


def diff_words(words_a: list[WordBox], words_b: list[WordBox]) -> list[Op]:
    """
    difflib's SequenceMatcher replaces the hand-rolled LCS table, and its
    'replace' opcode gives us `modified` directly instead of the
    adjacent remove+add pairing heuristic.
    """
    a = [w.text for w in words_a]
    b = [w.text for w in words_b]
    ops: list[Op] = []

    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                ops.append(Op("equal", i1 + k, j1 + k, a[i1 + k]))
        elif tag == "delete":
            for i in range(i1, i2):
                ops.append(Op("remove", a_index=i, text=a[i]))
        elif tag == "insert":
            for j in range(j1, j2):
                ops.append(Op("add", b_index=j, text=b[j]))
        else:  # replace
            for i in range(i1, i2):
                ops.append(Op("modified", a_index=i, text=a[i]))
            for j in range(j1, j2):
                ops.append(Op("modified", b_index=j, text=b[j]))
    return ops


def diff_page_text(page_a, page_b, scale: float) -> PageTextDiff:
    words_a = extract_word_boxes(page_a, scale) if page_a else []
    words_b = extract_word_boxes(page_b, scale) if page_b else []
    ops = diff_words(words_a, words_b)

    added = sum(1 for o in ops if o.op == "add")
    removed = sum(1 for o in ops if o.op == "remove")
    # `modified` is emitted on both sides; count the A-side entries once.
    modified = sum(1 for o in ops if o.op == "modified" and o.a_index is not None)

    return PageTextDiff(ops, words_a, words_b, added, removed, modified,
                        bool(words_a or words_b))


def visual_diff(img_a: Image.Image, img_b: Image.Image, threshold: int = 26):
    """
    Letterbox the smaller page onto white, then threshold the channel-max
    delta. Returns an RGBA mask that only paints changed pixels.
    """
    width = max(img_a.width, img_b.width)
    height = max(img_a.height, img_b.height)

    def normalize(src: Image.Image) -> Image.Image:
        if src.size == (width, height):
            return src
        canvas = Image.new("RGB", (width, height), "white")
        canvas.paste(src, (0, 0))
        return canvas

    a, b = normalize(img_a), normalize(img_b)
    delta = ImageChops.difference(a, b)
    # Max across channels approximates pixelmatch's per-pixel colour distance.
    r, g, bl = delta.split()
    flat = ImageChops.lighter(ImageChops.lighter(r, g), bl)
    mask = flat.point(lambda v: 255 if v > threshold else 0).convert("L")

    changed = sum(count for value, count in enumerate(mask.histogram()) if value > 0)
    total = width * height

    overlay = Image.new("RGBA", (width, height), PIXEL_DIFF + (0,))
    overlay.putalpha(mask.point(lambda v: 200 if v else 0))

    return overlay, changed, total, (1.0 if total == 0 else 1 - changed / total)


def _paint_text_overlay(base: Image.Image, diff: PageTextDiff, side: str, x_offset: int):
    """A shows remove+modified, B shows add+modified -- same split as buildSideOverlay."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for op in diff.ops:
        if op.op == "equal":
            continue
        if side == "A" and op.a_index is not None and op.op in ("remove", "modified"):
            box = diff.words_a[op.a_index]
            color = REMOVE if op.op == "remove" else MODIFIED
        elif side == "B" and op.b_index is not None and op.op in ("add", "modified"):
            box = diff.words_b[op.b_index]
            color = ADD if op.op == "add" else MODIFIED
        else:
            continue
        x = x_offset + box.x
        draw.rectangle([x, box.y, x + max(box.w, 2), box.y + max(box.h, 2)],
                       fill=color + (140,))
    base.alpha_composite(layer)


def compare(path_a: str, path_b: str, mode: str, out_path: str | None,
            password_a: str | None = None, password_b: str | None = None):
    doc_a = fitz.open(path_a)
    doc_b = fitz.open(path_b)

    for doc, pw, label in ((doc_a, password_a, path_a), (doc_b, password_b, path_b)):
        if doc.needs_pass:
            if not pw or not doc.authenticate(pw):
                sys.exit(f"error: {label} is encrypted and the password was missing or wrong")

    total_pages = max(doc_a.page_count, doc_b.page_count)
    report = fitz.open() if out_path else None
    max_edge = REPORT_MAX_EDGE if report else MAX_RENDER_EDGE

    for n in range(total_pages):
        page_a = doc_a[n] if n < doc_a.page_count else None
        page_b = doc_b[n] if n < doc_b.page_count else None

        scale_a, scale_b, page_w, page_h = pick_shared_scale(page_a, page_b, max_edge)
        img_a = render_page(page_a, scale_a) if page_a else None
        img_b = render_page(page_b, scale_b) if page_b else None

        composite = Image.new("RGBA", (page_w * 2 + GAP, page_h), (229, 229, 229, 255))
        if img_a:
            composite.paste(img_a, (0, 0))
        if img_b:
            composite.paste(img_b, (page_w + GAP, 0))

        if mode == "text":
            diff = diff_page_text(page_a, page_b, max(scale_a, scale_b))
            if not diff.has_text:
                print(f"page {n + 1}: no selectable text -- use --mode visual")
            else:
                _paint_text_overlay(composite, diff, "A", 0)
                _paint_text_overlay(composite, diff, "B", page_w + GAP)
                print(f"page {n + 1}: {diff.added} added, {diff.removed} removed, "
                      f"{diff.modified} modified")
        elif img_a and img_b:
            overlay, changed, total, similarity = visual_diff(img_a, img_b)
            composite.alpha_composite(overlay, (page_w + GAP, 0))
            print(f"page {n + 1}: similarity {similarity * 100:.2f}% "
                  f"({changed:,} of {total:,} pixels changed)")
        else:
            print(f"page {n + 1}: present on only one side")

        if report is not None:
            buf = io.BytesIO()
            composite.convert("RGB").save(buf, format="JPEG", quality=92)
            w, h = composite.width / 2, composite.height / 2
            page = report.new_page(width=w, height=h)
            page.insert_image(fitz.Rect(0, 0, w, h), stream=buf.getvalue())

    if report is not None:
        report.save(out_path, deflate=True)
        print(f"\nwrote {out_path}")


def main():
    ap = argparse.ArgumentParser(description="Compare two PDFs, PaperKnife style.")
    ap.add_argument("original")
    ap.add_argument("revised")
    ap.add_argument("--mode", choices=("text", "visual"), default="text")
    ap.add_argument("-o", "--out", help="write an annotated side-by-side report PDF")
    ap.add_argument("--password-a")
    ap.add_argument("--password-b")
    args = ap.parse_args()
    compare(args.original, args.revised, args.mode, args.out,
            args.password_a, args.password_b)


if __name__ == "__main__":
    main()
