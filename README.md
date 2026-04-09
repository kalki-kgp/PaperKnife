<p align="center">
  <img src="public/icons/logo-github.svg" width="120" alt="PaperKnife Logo">
</p>

# PaperKnife

**A simple, honest PDF utility that respects your privacy.**

[![License](https://img.shields.io/badge/license-AGPL--3.0-rose.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/kalki-kgp/PaperKnife?style=flat&color=rose)](https://github.com/kalki-kgp/PaperKnife/stargazers)
[![Web App](https://img.shields.io/badge/web-live-emerald.svg)](https://paperknife.app)
[![Twitter](https://img.shields.io/badge/twitter-@kalki--kgp-black?logo=x)](https://x.com/kalki-kgp)

---

## Preview

<p align="center">
  <img src="assets/preview/screenshot1.jpg" width="80%" alt="Web View">
</p>

---

### Why I built this

Most PDF websites ask you to upload your sensitive documents—bank statements, IDs, contracts—to their servers. Even if they promise to delete them, your data still leaves your device and travels across the internet.

I built **PaperKnife** to solve this. It's a collection of tools that run entirely in your browser. Your files never leave your device, they aren't stored in any database, and no server ever sees them. It works 100% offline.

### What it can do

**Edit**
- **Merge** — Combine multiple PDF files into one document.
- **Split** — Visually extract specific pages or ranges.
- **Rotate** — Fix page orientation permanently.
- **Rearrange** — Drag and drop pages to reorder them.
- **Watermark** — Overlay custom text for branding or security.
- **Page Numbers** — Add numbering to your documents automatically.
- **Signature** — Add your electronic signature to any document.

**Optimize**
- **Compress** — Reduce file size with different quality presets.
- **Grayscale** — Convert all pages to black and white.
- **Repair** — Attempt to fix corrupted or unreadable documents.

**Secure**
- **Protect** — Encrypt documents with a strong password.
- **Unlock** — Remove passwords from protected files.
- **Metadata** — Deep clean document properties for better privacy.

**Convert**
- **PDF to Image** — Convert pages into high-quality JPG or PNG.
- **Image to PDF** — Convert JPG, PNG, and WebP into a PDF.
- **Extract Images** — Pull out all original images embedded in a PDF.
- **PDF to Text** — Extract plain text from your documents.

### How to use it

Visit [paperknife.app](https://paperknife.app) — no sign-up, no downloads. You can also install it as a PWA for offline access, or download the Android app.

---

### Support the project

PaperKnife is a solo project. It's open-source and tracker-free because I believe privacy is a right, not a luxury.

If this tool has saved you time or kept your data safe, please consider:
- **Sponsoring:** Support development via [GitHub Sponsors](https://github.com/sponsors/kalki-kgp).
- **Giving a Star:** It helps other people find the project.
- **Spreading the word:** Share it with anyone who handles sensitive documents.

---

### Deployment

PaperKnife uses **BrowserRouter** for SEO-friendly URLs (e.g., `paperknife.app/merge` instead of `paperknife.app/#/merge`). This means your server must return `index.html` for all routes — otherwise direct navigation to `/merge`, `/split`, etc. will 404.

#### Quick start (local or VPS)

```bash
# 1. Install dependencies
bun install        # or npm install

# 2. Build for production
bun run build      # outputs to dist/

# 3. Serve with SPA fallback
npx serve -s dist -l 3000
```

The `-s` (single-page) flag tells `serve` to rewrite all routes to `index.html`, which is exactly what BrowserRouter needs.

#### With Nginx

```nginx
server {
    listen 80;
    server_name paperknife.app;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### With Cloudflare Tunnel

```yaml
# ~/.cloudflared/config.yml
ingress:
  - hostname: paperknife.app
    service: http://localhost:3000
  - service: http_status:404
```

```bash
npx serve -s dist -l 3000
cloudflared tunnel run
```

#### With Docker

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
RUN npm install -g serve
COPY --from=build /app/dist /app/dist
EXPOSE 3000
CMD ["serve", "-s", "/app/dist", "-l", "3000"]
```

#### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_BASE` | `/` | Base path for asset URLs (change for GitHub Pages: `./`) |
| `VITE_DISABLE_OCR` | `false` | Set to `true` to remove the PDF-to-Text tool (reduces bundle size) |

---

### Under the hood

PaperKnife is built with **React** and **TypeScript**. Core processing is handled by **pdf-lib** and **pdfjs-dist**, running in a sandboxed environment using WebAssembly.

This project is licensed under the **GNU AGPL v3** to ensure it remains open and transparent forever.

Originally based on [PaperKnife](https://github.com/potatameister/PaperKnife) by potatameister, licensed under AGPL-3.0.

---
*Made with care by [kalki-kgp](https://github.com/kalki-kgp)*
