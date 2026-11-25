/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { expect, test } from '@playwright/test'
import { getRouteSeo, indexablePaths } from '../src/seo'
import { expectNoProblems, watchPage } from './helpers'

for (const path of indexablePaths()) {
  test(`${path} loads cleanly`, async ({ page }) => {
    const problems = await watchPage(page)
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(getRouteSeo(path).title)
    await expect(page.locator('#root')).not.toBeEmpty()
    // Give lazy chunks, fonts and workers time to hit the CSP.
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
    expectNoProblems(problems)
  })
}

test('unknown paths return a real 404', async ({ page }) => {
  const response = await page.goto('/definitely-not-a-route')
  expect(response?.status()).toBe(404)
})

test('/api/ping counts same-origin posts and refuses the rest', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const body = { path: '/merge', kind: 'visit', ref: 'google.com', installed: false }
  // Not against production: it would add a fake visit to the real counts.
  if (!process.env.E2E_BASE_URL) {
    expect((await request.post('/api/ping', { data: body, headers: { Origin: origin } })).status()).toBe(204)
  }
  expect((await request.post('/api/ping', { data: body, headers: { Origin: 'https://evil.example' } })).status()).toBe(403)
  expect((await request.get('/api/ping')).status()).toBe(405)
  expect((await request.get('/api/nope')).status()).toBe(404)
})

test('the CSP still allows what the tools rely on', async ({ request }) => {
  const csp = (await request.get('/')).headers()['content-security-policy'] ?? ''
  const directive = (name: string) => csp.split(';').map(d => d.trim()).find(d => d.startsWith(`${name} `)) ?? ''
  expect(directive('connect-src'), 'results are read back with fetch(blob:)').toContain('blob:')
  expect(directive('script-src'), 'qpdf and tesseract need WebAssembly').toContain("'wasm-unsafe-eval'")
  expect(directive('worker-src'), 'pdf.js and tesseract run in workers').toContain('blob:')
})
