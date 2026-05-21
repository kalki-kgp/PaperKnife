import { describe, expect, test } from 'bun:test'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite'
import { parsePdfModDate, readSignatureCertificates } from '../../src/utils/signature/pdfSignature'
import { getTrustedRootCertificates } from '../../src/utils/signature/trustStore'
import { verifyX509RsaSha1 } from '../../src/utils/signature/x509RsaSha1'
import { buildX509SignedPdfFixture } from '../helpers/pdfTestUtils'

describe('x509RsaSha1', () => {
  test('parsePdfModDate reads PDF date strings', () => {
    const parsed = parsePdfModDate('D:20240115103045+05\'30\'')
    expect(parsed).not.toBeNull()
    expect(parsed?.getUTCFullYear()).toBe(2024)
    expect(parsed?.getUTCMonth()).toBe(0)
    expect(parsed?.getUTCDate()).toBe(15)
  })

  test('readSignatureCertificates finds /Cert after endobj-like hex padding', async () => {
    const cert = getTrustedRootCertificates()[0]
    const certHex = [...new Uint8Array(cert.toSchema().toBER(false))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const evilPad = ('656e646f626a' + 'ab'.repeat(20000)).slice(0, 32768)
    const pdf = buildX509SignedPdfFixture(evilPad, certHex, evilPad.length)
    const brIdx = new TextDecoder('latin1').decode(pdf).search(/\/ByteRange/i)
    const certs = await readSignatureCertificates(pdf, brIdx)
    expect(certs.length).toBeGreaterThan(0)
  })

  test('readSignatureCertificates finds /Cert after large Contents padding', async () => {
    const cert = getTrustedRootCertificates()[0]
    const certHex = [...new Uint8Array(cert.toSchema().toBER(false))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const pdf = buildX509SignedPdfFixture('ab'.repeat(128), certHex, 32768)
    const brIdx = new TextDecoder('latin1').decode(pdf).search(/\/ByteRange/i)
    const certs = await readSignatureCertificates(pdf, brIdx)
    expect(certs.length).toBeGreaterThan(0)
  })

  test('readSignatureCertificates parses cleartext /Cert on encrypted PDF without corrupting DER', async () => {
    const cert = getTrustedRootCertificates()[0]
    const certHex = [...new Uint8Array(cert.toSchema().toBER(false))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const signed = buildX509SignedPdfFixture('ab'.repeat(128), certHex, 4096)
    const encrypted = await encryptPDF(signed, 'KRIS2004')
    const brIdx = new TextDecoder('latin1').decode(encrypted).search(/\/ByteRange/i)
    const certs = await readSignatureCertificates(encrypted, brIdx, 'KRIS2004')
    expect(certs.length).toBeGreaterThan(0)
    expect(certs[0].subject.typesAndValues.length).toBeGreaterThan(0)
  })

  test('verifyX509RsaSha1 rejects missing certificates', async () => {
    const result = await verifyX509RsaSha1(
      new TextEncoder().encode('signed'),
      new Uint8Array(256),
      [],
      new Date()
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unsupported-signature')
    }
  })
})
