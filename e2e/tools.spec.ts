/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { expect, test, type Page } from '@playwright/test'
import { fixture } from './fixtures'
import { expectDownloadedFile, expectNoProblems, expectResultScreenWorks, watchPage, type OutputKind } from './helpers'

interface ToolCase {
  path: string
  files: string[]
  /** The button that runs the tool once a file is loaded. */
  action: string
  output: OutputKind[]
  preview: boolean
  prepare?: (page: Page) => Promise<void>
}

const SAMPLE = ['sample.pdf']

const toolCases: ToolCase[] = [
  { path: '/merge', files: ['sample.pdf', 'sample.pdf'], action: 'Merge PDFs', output: ['pdf'], preview: true },
  { path: '/split', files: SAMPLE, action: 'Extract 3 Pages', output: ['pdf'], preview: true },
  { path: '/compress', files: SAMPLE, action: 'Compress PDF', output: ['pdf'], preview: true },
  {
    path: '/protect', files: SAMPLE, action: 'Encrypt & Save', output: ['pdf'], preview: false,
    prepare: async (page) => {
      const passwords = page.locator('input[type=password]')
      await expect(passwords).toHaveCount(2)
      await passwords.nth(0).fill('regression-test')
      await passwords.nth(1).fill('regression-test')
    }
  },
  { path: '/unlock', files: SAMPLE, action: 'Unlock PDF', output: ['pdf'], preview: true },
  { path: '/rotate-pdf', files: SAMPLE, action: 'Save Rotated PDF', output: ['pdf'], preview: true },
  { path: '/crop-pdf', files: SAMPLE, action: 'Crop PDF', output: ['pdf'], preview: true },
  { path: '/rearrange-pdf', files: SAMPLE, action: 'Save New Order', output: ['pdf'], preview: true },
  { path: '/page-numbers', files: SAMPLE, action: 'Add Page Numbers', output: ['pdf'], preview: true },
  { path: '/watermark', files: SAMPLE, action: 'Apply Watermark', output: ['pdf'], preview: true },
  { path: '/metadata', files: SAMPLE, action: 'Update Metadata', output: ['pdf'], preview: true },
  {
    path: '/fill-pdf', files: ['form.pdf'], action: 'Save Filled PDF', output: ['pdf'], preview: true,
    prepare: async (page) => {
      await page.getByRole('textbox', { name: 'name', exact: true }).fill('Ada Lovelace')
    }
  },
  { path: '/grayscale', files: SAMPLE, action: 'Convert to Grayscale', output: ['pdf'], preview: true },
  { path: '/pdf-to-image', files: SAMPLE, action: 'Convert to Images', output: ['zip', 'image'], preview: false },
  { path: '/image-to-pdf', files: ['sample.png'], action: 'Generate PDF', output: ['pdf'], preview: true },
  { path: '/extract-images', files: SAMPLE, action: 'Extract Raw Images', output: ['zip', 'image'], preview: false },
  { path: '/repair', files: SAMPLE, action: 'Attempt Repair', output: ['pdf'], preview: true },
  { path: '/word-to-pdf', files: ['sample.docx'], action: 'Convert to PDF', output: ['pdf'], preview: true }
]

const openTool = async (page: Page, path: string, files: string[]) => {
  await page.goto(path)
  await page.locator('input[type=file]').first().setInputFiles(files.map(fixture))
}

// The header's tool switcher shares its label with some action buttons.
const actionButton = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).filter({ hasNot: page.locator('.lucide-chevron-down') }).last()

for (const tool of toolCases) {
  test(`${tool.path} produces a downloadable, previewable result`, async ({ page }) => {
    const problems = await watchPage(page)
    await openTool(page, tool.path, tool.files)
    await tool.prepare?.(page)
    await actionButton(page, tool.action).click()
    await expectResultScreenWorks(page, tool.output, { preview: tool.preview })
    expectNoProblems(problems)
  })
}

test('/signature: drawn ink is visible on the pad, and the signed PDF downloads', async ({ page }) => {
  const problems = await watchPage(page)
  await openTool(page, '/signature', SAMPLE)
  await page.getByRole('button', { name: /Draw Signature/ }).click()

  const pad = page.locator('canvas')
  const box = (await pad.boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 100)
  await page.mouse.down()
  for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + 40 + i * 12, box.y + 90 + Math.sin(i / 3) * 40)
  await page.mouse.up()

  // The ink is near-black, so the pad must stay light in every design variant.
  for (const design of ['default', 'midnight']) {
    await page.evaluate((d) => {
      if (d === 'midnight') document.documentElement.dataset.design = 'midnight'
      else delete document.documentElement.dataset.design
    }, design)
    const background = await pad.evaluate(el => getComputedStyle(el).backgroundColor)
    const [r, g, b] = background.match(/\d+/g)!.map(Number)
    expect((r + g + b) / 3, `pad background in ${design} design`).toBeGreaterThan(200)
  }

  await page.getByRole('button', { name: 'Use Signature' }).click()
  await page.getByRole('button', { name: /Sign & Save/ }).first().click()
  await expectResultScreenWorks(page, ['pdf'], { preview: true })
  expectNoProblems(problems)
})

test('/pdf-to-text downloads the extracted text', async ({ page }) => {
  const problems = await watchPage(page)
  await openTool(page, '/pdf-to-text', SAMPLE)
  await page.getByRole('button', { name: 'Extract Text', exact: true }).click()

  const downloadButton = page.getByRole('button', { name: 'Download', exact: true })
  await expect(downloadButton).toBeVisible({ timeout: 60_000 })
  const downloadEvent = page.waitForEvent('download')
  await downloadButton.click()
  const bytes = await expectDownloadedFile(await downloadEvent, ['text'])
  expect(bytes.toString('utf8')).toContain('regression fixture')
  expectNoProblems(problems)
})

test('/compare renders a diff and exports the report', async ({ page }) => {
  const problems = await watchPage(page)
  await page.goto('/compare')
  const inputs = page.locator('input[type=file]')
  await inputs.nth(0).setInputFiles(fixture('sample.pdf'))
  await inputs.nth(1).setInputFiles(fixture('sample.pdf'))

  const report = page.getByLabel('Download diff report')
  await expect(report).toBeVisible({ timeout: 60_000 })
  const downloadEvent = page.waitForEvent('download')
  await report.click()
  await expectDownloadedFile(await downloadEvent, ['pdf', 'zip', 'image', 'text'])
  expectNoProblems(problems)
})
