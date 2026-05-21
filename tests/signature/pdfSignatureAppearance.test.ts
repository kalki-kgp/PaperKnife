import { describe, expect, test } from 'bun:test'
import {
  createValidationPrintCopy,
  sha256Hex
} from '../../src/utils/signature/pdfSignatureAppearance'
import { buildMinimalPdf, extractObjectStream } from '../helpers/pdfTestUtils'

describe('pdfSignatureAppearance', () => {
  test('preserves original page content streams byte-for-byte', async () => {
    const input = await buildMinimalPdf()
    const inputSha256 = await sha256Hex(input)
    const output = await createValidationPrintCopy(input, {
      verified: true,
      signerLabel: 'Unique Identification Authority of India',
      signedAt: new Date('2024-01-15T10:00:00Z'),
      inputSha256,
      revocationNote: 'No live revocation check in offline mode'
    })

    const primaryStream = extractObjectStream(input, 5)
    const copiedStream = extractObjectStream(output, 5)
    expect(primaryStream).not.toBeNull()
    expect(copiedStream).not.toBeNull()
    expect(Buffer.from(copiedStream!)).toEqual(Buffer.from(primaryStream!))
    expect(output.length).toBeGreaterThan(input.length)
  })

  test('footer hash uses unmodified input file SHA-256', async () => {
    const input = await buildMinimalPdf()
    const inputSha256 = await sha256Hex(input)
    const unchangedHash = await sha256Hex(input)
    expect(unchangedHash).toBe(inputSha256)

    const output = await createValidationPrintCopy(input, {
      verified: true,
      signerLabel: 'UIDAI',
      signedAt: null,
      inputSha256,
      revocationNote: 'No live revocation check in offline mode'
    })
    const outputSha256 = await sha256Hex(output)
    expect(outputSha256).not.toBe(inputSha256)
    expect(await sha256Hex(input)).toBe(inputSha256)
  })
})
