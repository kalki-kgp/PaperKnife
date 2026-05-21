/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fromBER } from 'asn1js'
import { Certificate } from 'pkijs'

export interface TrustedRoot {
  id: 'cca-india-2014' | 'cca-india-2022-spl'
  label: string
  sha256Fingerprint: string
  pem: string
}

const CCA_INDIA_2014_PEM = `-----BEGIN CERTIFICATE-----
MIIDIzCCAgugAwIBAgICJ60wDQYJKoZIhvcNAQELBQAwOjELMAkGA1UEBhMCSU4x
EjAQBgNVBAoTCUluZGlhIFBLSTEXMBUGA1UEAxMOQ0NBIEluZGlhIDIwMTQwHhcN
MTQwMzA1MTAxMDQ5WhcNMjQwMzA1MTAxMDQ5WjA6MQswCQYDVQQGEwJJTjESMBAG
A1UEChMJSW5kaWEgUEtJMRcwFQYDVQQDEw5DQ0EgSW5kaWEgMjAxNDCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAN7IUL2K/yINrn+sglna9CkJ1AVrbJYB
vsylsCF3vhStQC9kb7t4FwX7s+6AAMSakL5GUDJxVVNhMqf/2paerAzFACVNR1Ai
MLsG7ima4pCDhFn7t9052BQRbLBCPg4wekx6j+QULQFeW9ViLV7hjkEhKffeuoc3
YaDmkkPSmA2mz6QKbUWYUu4PqQPRCrkiDH0ikdqR9eyYhWyuI7Gm/pc0atYnp1sr
u3rtLCaLS0ST/N/ELDEUUY2wgxglgoqEEdMhSSBL1CzaA8Ck9PErpnqC7VL+sbSy
AKeJ9n56FttQzkwYjdOHMrgJRZaPb2i5VoVo1ZFkQF3ZKfiJ25VH5+8CAwEAAaMz
MDEwDwYDVR0TAQH/BAUwAwEB/zARBgNVHQ4ECgQIQrjFz22zV+EwCwYDVR0PBAQD
AgEGMA0GCSqGSIb3DQEBCwUAA4IBAQAdAUjv0myKyt8GC1niIZplrlksOWIR6yXL
g4BhFj4ziULxsGK4Jj0sIJGCkNJeHl+Ng9UlU5EI+r89DRdrGBTF/I+g3RHcViPt
One9xEgWRMRYtWD7QZe5FvoSSGkW9aV6D4iGLPBQML6FDUkQzW9CYDCFgGC2+awR
Mx61dQVXiFv3Nbkqa1Pejcel8NMAmxjfm5nZMd3Ft13hy3fNF6UzsOnBtMbyZWhS
8Koj2KFfSUGX+M/DS1TG2ZujwKKXCuKq7+67m0WF6zohoHJbqjkmKX34zkuFnoXa
Xco9NkOi0RBvLCiqR2lKfzLM7B69bje+z0EqnRNo5+s8PWSdy+xt
-----END CERTIFICATE-----`

const CCA_INDIA_2022_SPL_PEM = `-----BEGIN CERTIFICATE-----
MIIFPDCCAySgAwIBAgIQYoKBxu6+xz94CH5f9Y9J9DANBgkqhkiG9w0BAQsFADA+
MQswCQYDVQQGEwJJTjESMBAGA1UEChMJSW5kaWEgUEtJMRswGQYDVQQDExJDQ0Eg
SW5kaWEgMjAyMiBTUEwwHhcNMjIwOTIwMDkxODE5WhcNNDIwOTIwMDkxODE5WjA+
MQswCQYDVQQGEwJJTjESMBAGA1UEChMJSW5kaWEgUEtJMRswGQYDVQQDExJDQ0Eg
SW5kaWEgMjAyMiBTUEwwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDM
A++VJxEXN+coznBAEf0dz+8DBj9SpEQGoehjxoDnD+WYEBAXnap2lh5yE7/wlpHU
Q7hJ54JsqLBZQGkM0pk35bkvvcf2wAGSdK0KRilNeFDmVdduqAUJUlmNeL0ufIuf
sSBEusOWKK6VvQHxiZ0qoyoeqV+CpnDm8I2IE0WBSbaotXtGWSyBLNDCEH3lRA9G
QDOZ5Utc8soR2YVwbQSicGoyAC1PiPah7LY6nZCbBjc63r22dE+Cm1TGeqEb0ZUd
hHl051WqEGXXmtQNfytdNP+VdKU1nrYEcQ5BeGMaWA5bHkO2ERldI5F55pX06hUx
wjL39H6JVX5/0I+bBiPsZiCpea2gKozNBg+MBWLqyBUzFRVhLfdCPB6tm9EKHgrl
P6rsWrjgZ5FcREmerCYs7HIYeemiI0UO4X8rqpobT3rL7mWALB2plyFaBdiUWW1r
87eZQDEeYWavOhNITYNc31FG3Kn8DANF3IhNeYmUDzG7/M1XyGycqBmXG7tVVXez
O1GbgfM0SYlkVFRDOD6u9Tf0lR1MfjrJpMB+JdIJlimMM5G6LGia7+3Nlll8SJ0D
hW49FdKlLB92iXuOok4iwPzyFKg8Eax/9iN9TxMadYxbpKkePL9DpL/ymRvpGDkP
aurqUP77smtB8Jlf7bx8SB9DWVjVqsgvemN+DZfNawIDAQABozYwNDAPBgNVHRMB
Af8EBTADAQH/MBEGA1UdDgQKBAhIEoydvDOh6jAOBgNVHQ8BAf8EBAMCAQYwDQYJ
KoZIhvcNAQELBQADggIBADYv91JbnwU+Ih5gNzZSJY0yJkYk4tbBBsCZDivmZknC
TbM8B9j/hEZcfXZCTbP6GCGkrxVx8aDl7E1s5DGmdO7x5R+dxrLD2B4+ORhDetlM
Yd22mopVnzqY5UdaQ8u16JNEp/m75UqT5NvcgtE+/s1Hr+3lhWKKvN7u9PxDSIoM
T/I0/sje9fWwjeX29nzqHTw7hYTLCIeQv8c9+wGBFAAFArUq0MaI6jxIav10DKeH
ptycUHwMNyzP9hh7G4nHo+lEIT0/jWIrjv53+aVFLdAvBKQ2jyAKd/OhuQFCue3z
MVMoTQ7Zl9HZk72CkBecaZhHnEzqjpOzueCweK0h27IvwED7scudpOPnY7ml6fEF
dpHXZXcVz8TZbqirkHTLepfAOUBcyuadAKkOR+m5uU1UKkESexaY2yVEdWcVAeCM
6p6FXlFeRMEebMbppkPeSFUPMRA9mhsUTOk5sbnGN2TVkSfUpcUMoQgz2bSqvGyR
7sAZ9Un457swjwEEEnzijdMvd9YDj1wRq+tsq38zq5IaE50VMMXeBoVz2/2Bn8Mr
p8kN7XIkrCui8wjclnG9BB1SbwjXPhE+7zE6GKh+oIRZua2RkamTpjwe+2oSihGV
FeD7pSMh/Pgyxg1lxSVDKvbBdxNrBpot2OQN35+DkAU2exJMtUYAvzdPVx9d2elo
-----END CERTIFICATE-----`

export const TRUSTED_ROOTS: TrustedRoot[] = [
  {
    id: 'cca-india-2014',
    label: 'CCA India 2014',
    sha256Fingerprint: '60109bc6c38328598a112c7a25e38b0f23e5a7511cb815fb64e0c4ff05db7df7',
    pem: CCA_INDIA_2014_PEM
  },
  {
    id: 'cca-india-2022-spl',
    label: 'CCA India 2022 SPL',
    sha256Fingerprint: 'b724689b79b2ef9421ef8f5cc733eb093851b170ee715177005a09f226d8c91a',
    pem: CCA_INDIA_2022_SPL_PEM
  }
]

const pemToDer = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

let cachedRootCerts: Certificate[] | null = null

export const getTrustedRootCertificates = (): Certificate[] => {
  if (cachedRootCerts) return cachedRootCerts
  cachedRootCerts = TRUSTED_ROOTS.map((root) => {
    const parsed = fromBER(pemToDer(root.pem))
    if (parsed.offset === -1) throw new Error(`Failed to parse ${root.label}`)
    return new Certificate({ schema: parsed.result })
  })
  return cachedRootCerts
}

export const sha256Fingerprint = async (der: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', der)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const isPinnedTrustedRoot = async (cert: Certificate): Promise<boolean> => {
  const der = cert.toSchema().toBER(false)
  const fp = await sha256Fingerprint(der)
  return TRUSTED_ROOTS.some((r) => r.sha256Fingerprint === fp)
}

const EAADHAAR_SIGNER_MARKERS = [
  'unique identification authority of india',
  'uidai',
  'ncode solutions',
  'ncode'
]

const DN_UIDAI_MARKERS = EAADHAAR_SIGNER_MARKERS

const rdnToString = (cert: Certificate): string => {
  return cert.subject.typesAndValues
    .map((rdn) => {
      const block = rdn.value.valueBlock as { value?: string }
      return (block.value ?? '').trim()
    })
    .filter(Boolean)
    .join(' ')
}

export const certificateSubjectPlain = (cert: Certificate): string => rdnToString(cert)

export const isUidaiSignerIdentity = (cert: Certificate): boolean => {
  const subject = certificateSubjectPlain(cert).toLowerCase()
  return DN_UIDAI_MARKERS.some((marker) => subject.includes(marker))
}
