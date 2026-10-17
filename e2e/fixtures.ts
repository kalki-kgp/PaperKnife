/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.fixtures')
export const fixture = (name: string) => join(FIXTURE_DIR, name)

const pngChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

// A gradient big enough that pdf.js keeps it as an image XObject rather than
// inlining it, so Extract Images has something real to find.
const makePng = (size: number) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const rows = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) rows.set([x % 256, y % 256, 128], y * (size * 3 + 1) + 1 + x * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

const PNG = makePng(200)

const samplePdf = async () => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const image = await doc.embedPng(PNG)
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([612, 792])
    page.drawText(`PaperKnife regression fixture, page ${i}`, { x: 72, y: 700, size: 18, font })
    page.drawImage(image, { x: 72, y: 500, width: 120, height: 120 })
    page.drawRectangle({ x: 300, y: 500, width: 120, height: 120, color: rgb(0.9, 0.4, 0.3) })
  }
  return doc.save()
}

const formPdf = async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const form = doc.getForm()
  const name = form.createTextField('applicant.name')
  name.addToPage(page, { x: 72, y: 680, width: 300, height: 24 })
  const agree = form.createCheckBox('applicant.agree')
  agree.addToPage(page, { x: 72, y: 640, width: 16, height: 16 })
  return doc.save()
}

const sampleDocx = async () => {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>PaperKnife regression fixture</w:t></w:r></w:p></w:body></w:document>')
  return zip.generateAsync({ type: 'uint8array' })
}

export const writeFixtures = async () => {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  writeFileSync(fixture('sample.pdf'), await samplePdf())
  writeFileSync(fixture('form.pdf'), await formPdf())
  writeFileSync(fixture('sample.png'), PNG)
  writeFileSync(fixture('sample.docx'), await sampleDocx())
}
