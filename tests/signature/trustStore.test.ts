import { describe, expect, test } from 'bun:test'
import {
  TRUSTED_ROOTS,
  getTrustedRootCertificates,
  isPinnedTrustedRoot,
  isUidaiSignerIdentity,
  sha256Fingerprint
} from '../../src/utils/signature/trustStore'

describe('trustStore', () => {
  test('pinned SHA-256 fingerprints match bundled CCA India roots', async () => {
    const certs = getTrustedRootCertificates()
    expect(certs.length).toBe(TRUSTED_ROOTS.length)
    for (const cert of certs) {
      const fp = await sha256Fingerprint(cert.toSchema().toBER(false))
      expect(TRUSTED_ROOTS.map((r) => r.sha256Fingerprint)).toContain(fp)
    }
  })

  test('rejects non-pinned certificate', async () => {
    const certs = getTrustedRootCertificates()
    const pinned = await isPinnedTrustedRoot(certs[0])
    expect(pinned).toBe(true)
    const randomDer = crypto.getRandomValues(new Uint8Array(32)).buffer
    const fake = { toSchema: () => ({ toBER: () => randomDer }) } as Parameters<typeof isPinnedTrustedRoot>[0]
    await expect(isPinnedTrustedRoot(fake)).resolves.toBe(false)
  })

  test('CCA root is not treated as UIDAI signer', () => {
    const certs = getTrustedRootCertificates()
    expect(isUidaiSignerIdentity(certs[0])).toBe(false)
  })
})
