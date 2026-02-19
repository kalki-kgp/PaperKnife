# PaperKnife Web App

Standalone web version of the PaperKnife PDF toolkit.

## Run locally

```bash
npm install
npm run dev
```

## Build for deployment

```bash
npm run build
```

Build output is generated in `dist/` and can be deployed to static hosts such as Netlify, Vercel static, Cloudflare Pages, Firebase Hosting, or GitHub Pages.

## Notes

- Uses `HashRouter` to avoid server-side route rewrites.
- Vite `base` is set to `./` for subpath-friendly deployments.
- This UI is client-side and designed to mirror PaperKnife's Android workflow patterns for the web.
