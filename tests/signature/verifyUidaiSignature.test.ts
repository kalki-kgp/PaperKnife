import { describe, expect, test } from 'bun:test'
import { decryptPDF } from '@localonlytools/pdf-decrypt'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite'
import {
  extractPdfSignatureWithDecryptedContents
} from '../../src/utils/signature/pdfSignature'
import { failureMessage, verifyUidaiPdfSignature } from '../../src/utils/signature/verifyUidaiSignature'
import { buildMinimalPdf, buildSignedPdfFixture } from '../helpers/pdfTestUtils'

describe('verifyUidaiSignature', () => {
  test('maps unsigned PDF to unsupported-signature', async () => {
    const pdf = await buildMinimalPdf()
    const result = await verifyUidaiPdfSignature(pdf)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unsupported-signature')
      expect(failureMessage(result.reason)).toContain('not supported')
    }
  })

  test('merges ByteRange from original bytes with Contents from decrypted copy', async () => {
    const signed = buildSignedPdfFixture('3082' + 'ab'.repeat(80))
    const extracted = await extractPdfSignatureWithDecryptedContents(signed, signed, 'unused')
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.signedBytes.length).toBe(extracted.byteRange[1] + extracted.byteRange[3])
  })

  test('decrypts PKCS#7 Contents from encrypted signed PDF gap', async () => {
    const signed = buildSignedPdfFixture('3082' + 'ab'.repeat(80))
    const encrypted = await encryptPDF(signed, 'KRIS2004')
    const decrypted = await decryptPDF(encrypted, 'KRIS2004')
    const extracted = await extractPdfSignatureWithDecryptedContents(encrypted, decrypted, 'KRIS2004')
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.signedBytes.length).toBe(extracted.byteRange[1] + extracted.byteRange[3])
  })

  test('failure messages cover all Phase 1 states', () => {
    const reasons = [
      'tampered',
      'unknown-ca',
      'not-uidai',
      'expired-at-signing-time',
      'time-unavailable',
      'unsupported-signature',
      'evidence-unavailable-offline',
      'encrypted-copy-needs-password'
    ] as const
    for (const reason of reasons) {
      expect(failureMessage(reason).length).toBeGreaterThan(10)
    }
  })
})
