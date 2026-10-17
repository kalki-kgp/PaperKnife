/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFileSync } from 'node:fs'
import { expect, type Download, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

// Known, accepted blocks. Anything else the CSP refuses fails the test.
// fonts.bunny.net: the webfont import in index.css, blocked since the CSP shipped.
// cloudflareinsights: the analytics beacon Cloudflare injects on production.
const ALLOWED_VIOLATIONS = [/fonts\.bunny\.net/, /cloudflareinsights\.com/]

export interface PageProblems {
  cspViolations: string[]
  pageErrors: string[]
}

/** Records CSP violations and uncaught errors for the whole life of the page. */
export const watchPage = async (page: Page): Promise<PageProblems> => {
  const problems: PageProblems = { cspViolations: [], pageErrors: [] }
  page.on('console', (message) => {
    const text = message.text()
    if (/Content Security Policy/i.test(text) && !ALLOWED_VIOLATIONS.some(re => re.test(text))) {
      problems.cspViolations.push(text)
    }
  })
  page.on('pageerror', (error) => problems.pageErrors.push(error.message))
  return problems
}

export const expectNoProblems = (problems: PageProblems) => {
  expect(problems.cspViolations, 'Content Security Policy blocked something').toEqual([])
  expect(problems.pageErrors, 'uncaught page errors').toEqual([])
}

export type OutputKind = 'pdf' | 'zip' | 'image' | 'text'

const MAGIC: Record<Exclude<OutputKind, 'text'>, (b: Buffer) => boolean> = {
  pdf: b => b.subarray(0, 5).toString('latin1') === '%PDF-',
  zip: b => b.subarray(0, 2).toString('latin1') === 'PK',
  image: b => b[0] === 0x89 || (b[0] === 0xff && b[1] === 0xd8)
}

/** Fails unless the download is a real, non-empty file of one of the expected kinds. */
export const expectDownloadedFile = async (download: Download, kinds: OutputKind[]) => {
  const path = await download.path()
  const bytes = readFileSync(path)
  expect(bytes.length, `${download.suggestedFilename()} is empty`).toBeGreaterThan(0)

  const kind = kinds.find(k => k === 'text' || MAGIC[k](bytes))
  expect(kind, `${download.suggestedFilename()} is not ${kinds.join(' or ')}`).toBeTruthy()
  if (kind === 'pdf') await PDFDocument.load(bytes, { ignoreEncryption: true })
  return bytes
}

/**
 * Exercises the shared result screen every tool ends on: Download must hand
 * over a real file, and Preview must open the viewer.
 */
export const expectResultScreenWorks = async (page: Page, kinds: OutputKind[], { preview }: { preview: boolean }) => {
  const downloadButton = page.getByRole('button', { name: 'Download', exact: true })
  await expect(downloadButton).toBeVisible({ timeout: 60_000 })

  const downloadEvent = page.waitForEvent('download', { timeout: 15_000 })
  await downloadButton.click()
  await expectDownloadedFile(await downloadEvent, kinds)

  if (preview) {
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByLabel('Close preview')).toBeVisible()
    await page.getByLabel('Close preview').click()
  }

  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /fail/i })).toHaveCount(0)
}
