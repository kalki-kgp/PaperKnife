/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// The site is static files. This Worker only runs for /api/* (run_worker_first in
// wrangler.jsonc); every other request goes straight to the assets.
//
// POST /api/ping adds one to a daily counter. What is kept per day:
// page path (only the app's own routes), the linking site's hostname, the visitor's
// country (from Cloudflare), visit-or-view, and whether PaperKnife runs as an installed
// app. No IP address, cookie, user agent or identifier is stored, and nothing about files.

import { routeSeo } from '../src/seo'

interface Env {
  ASSETS: Fetcher
  STATS: D1Database
}

const sameSite = (request: Request): boolean => {
  const origin = request.headers.get('Origin')
  if (!origin) return false
  try {
    const from = new URL(origin).host
    return from === new URL(request.url).host || from === request.headers.get('Host')
  } catch {
    return false
  }
}

const cleanPath = (raw: unknown): string => {
  const p = typeof raw === 'string' ? raw.split(/[?#]/)[0].replace(/\/+$/, '') || '/' : ''
  return Object.prototype.hasOwnProperty.call(routeSeo, p) ? p : '(other)'
}

const cleanRef = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw) return ''
  const host = raw.toLowerCase().replace(/^www\./, '')
  if (!/^[a-z0-9.-]{1,80}$/.test(host) || host === 'paperknife.app' || host.endsWith('.paperknife.app')) return ''
  return host
}

async function ping(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  if (!sameSite(request)) return new Response(null, { status: 403 })
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }
  const day = new Date().toISOString().slice(0, 10)
  const kind = body.kind === 'visit' ? 'visit' : 'view'
  const country = String((request as Request & { cf?: { country?: string } }).cf?.country ?? '').slice(0, 2) || '??'
  await env.STATS.prepare(
    `INSERT INTO hits (day, path, ref, country, kind, installed, n) VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT (day, path, ref, country, kind, installed) DO UPDATE SET n = n + 1`
  ).bind(day, cleanPath(body.path), kind === 'visit' ? cleanRef(body.ref) : '', country, kind, body.installed ? 1 : 0).run()
  return new Response(null, { status: 204 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/ping') return ping(request, env)
    if (url.pathname.startsWith('/api/')) return new Response(null, { status: 404 })
    return env.ASSETS.fetch(request)
  }
} satisfies ExportedHandler<Env>
