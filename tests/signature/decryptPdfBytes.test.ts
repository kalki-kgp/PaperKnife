import { describe, expect, test } from 'bun:test'
import { PDFDocument } from 'pdf-lib'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite'
import { pdfHasEncryptionMarker } from '../../src/utils/pdfEncryption'
import {
  DecryptPdfError,
  decryptPdfBytesForInspection,
  readPdfEncryptionInfo
} from '../../src/utils/signature/decryptPdfBytes'
describe('decryptPdfBytes', () => {
  test('decrypts RC4-protected PDF bytes for inspection', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([200, 200])
    const encrypted = await encryptPDF(await doc.save(), 'eaadhaar-test')
    expect(pdfHasEncryptionMarker(encrypted)).toBe(true)

    const info = await readPdfEncryptionInfo(encrypted)
    expect(info.encrypted).toBe(true)

    const decrypted = await decryptPdfBytesForInspection(encrypted, 'eaadhaar-test')
    expect(pdfHasEncryptionMarker(decrypted)).toBe(false)
  })

  test('rejects wrong password with a clear message', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([100, 100])
    const encrypted = await encryptPDF(await doc.save(), 'secret')
    await expect(decryptPdfBytesForInspection(encrypted, 'wrong')).rejects.toBeInstanceOf(DecryptPdfError)
  })
})
