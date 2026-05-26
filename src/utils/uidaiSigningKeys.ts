/**
 * PaperKnife - Bundled UIDAI signing public keys
 * Copyright (C) 2026 kalki-kgp
 *
 * For encrypted e-Aadhaar PDFs the /Cert entry in the signature dictionary
 * is encrypted under the file key, so we can't read the signer cert
 * directly without first decrypting the PDF. As a Phase-1 workaround, we
 * bundle UIDAI's published signing public keys (SubjectPublicKeyInfo, DER)
 * and trial-verify the signature against each.
 *
 * Each entry is the cert's full SPKI bytes — that's the SAME format
 * WebCrypto consumes via importKey('spki', ...), and the SHA-256 of these
 * bytes gives us a stable fingerprint for the trust UI.
 *
 * Source: https://uidai.gov.in/en/916-developer-section/data-and-downloads-section/19388-uidai-certificate-details-2.html
 * Downloaded + parsed locally with: openssl x509 -in <cert>.cer -pubkey -noout | openssl pkey -pubin -outform DER
 *
 * Refresh when UIDAI rotates: re-download .cer, rerun openssl, paste the
 * new base64 entry below.
 */

export interface UidaiKnownKey {
  label: string
  spkiBase64: string
  validFrom: string
  validTo: string
}

export const UIDAI_KNOWN_KEYS: UidaiKnownKey[] = [
  {
    label: 'UIDAI Auth Production (PID encryption)',
    validFrom: '2025-08-14',
    validTo: '2028-08-13',
    spkiBase64:
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz83ldUE+gDAtZlmBKSJH/g1vbIsYWMr7P8Z96qRote0hQkm3Dik50r3Ls19wCv02+/tE/zXPmzFVMzyPuyykntaU8nazBTqgPHn4T80qfu02AfLAQBICtGR2Scjl+LukxgU5rpvx5JhzcNkTAUyCHatr6b/RPrzKEiUUf5QQn+FU5HJWUIvU3W3TJ8A/CNx0OxYAMOacOMXuX6ENUKvh8jKf31NeV8rgF0SQ47R1Tnv5w/JcmmklO9hcxX8UMUx4bvLXP3YN/Y86/nV1DYVT31FtpnKu5FTIytzTvKowj1B+twox1Ui7t1tAt8aWFBCX9cG7zK1MmY/GdDEWyHhoDwIDAQAB',
  },
  {
    label: 'UIDAI Auth Signing Production 2026',
    validFrom: '2023-04-28',
    validTo: '2026-04-28',
    spkiBase64:
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt6ei4Qnec7W2nWNYa3d6zwNzTPtrHogh1iAv62ydWg4rFKUYGhxP79shMmczd/Ef8ij8uoUUVKvCjn3QLxVnrOqhQYyNCn0VbUw1WX8Nj1IiNaSFMoXtLqqFuszjenGlLiNvGIbYAwMy8tfIOg6dRcXFN+3fIrWVnOz7OUA53tIkFQyV0gITwtxqrKtnXQAbuAILh1YiVVMH4F/N0Chx500tZpAfMGUQBKkwbP2jTcw8Dw4vd6MxKlzr40N5NYaG3Ngx/3ASSOjzPcNvTIP52X6p392vgmCxKbfc79IdkB80QxqlPOshAzS5E50k5t5YOlc3Tzq3Jq9TkN+/NXU2xQIDAQAB',
  },
  {
    label: 'UIDAI Document Signer (DS) — legacy',
    validFrom: '2017-06-08',
    validTo: '2020-06-07',
    spkiBase64:
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv0HjbFpvu/kR+gTI2+svGNmW4eZHhTVBG/N+byaq3GH0SDM+jO5RW4BbXNzaSKc0I5mIyN1vQf2KmNV/3Xai6MokiiZrBRfM8a497zCMteHTAzSP1L0DmohUuBQh/s1hfqRIIWpfEu7noW2G8toK0ZOQR1E0FtinWNtqEeuxlNEKgfxkN4/vRzgvGFw+PPcoG5uMdcd7/DjDE1i20zmT+55DgIBrneCwrW7nIM0Md3BPOTV8iBwzjdVcdDHhMtSpi9UKUHw80sDRZp7ygB4Z0QmhSxCMCg9g7KPHYY+PVRC2sFreZBC6rtmIL+HMUPciRCCqMZLx3f6xRSD97lZr/wIDAQAB',
  },
]

export function spkiBytesOf(key: UidaiKnownKey): Uint8Array {
  const binary = atob(key.spkiBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
