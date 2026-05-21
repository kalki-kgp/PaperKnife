import { describe, expect, test } from 'bun:test'
import { stripPkcs7Padding, verifyDetachedCms } from '../../src/utils/signature/pkcs7'

describe('pkcs7', () => {
  test('stripPkcs7Padding removes trailing zero bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 0, 0, 0])
    expect(stripPkcs7Padding(bytes)).toEqual(new Uint8Array([1, 2, 3]))
  })

  test('verifyDetachedCms fails for invalid CMS', async () => {
    const signed = new TextEncoder().encode('signed-chunk')
    const cms = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x00])
    const result = await verifyDetachedCms(signed, cms)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['tampered', 'unsupported-signature']).toContain(result.reason)
    }
  })

  test('verifyDetachedCms reports tampered signature bytes', async () => {
    const signed = new TextEncoder().encode('%PDF-1.4 signed body example')
    const garbage = new Uint8Array(128)
    const result = await verifyDetachedCms(signed, garbage)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unsupported-signature')
    }
  })
})
