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

- Uses `BrowserRouter` by default for SEO-friendly URLs.
- Set `VITE_USE_HASH_ROUTER=true` if your host does not support SPA rewrites.
- Includes route-level SEO metadata updates, `robots.txt`, and `sitemap.xml`.
- Vite `base` remains `./` for subpath-friendly deployments.
