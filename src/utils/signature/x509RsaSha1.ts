/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Certificate, CertificateChainValidationEngine } from 'pkijs'
import {
  certificateSubjectPlain,
  getTrustedRootCertificates,
  isPinnedTrustedRoot,
  isUidaiSignerIdentity
} from './trustStore'
import type { SignatureFailureReason } from './types'

export interface X509VerificationSuccess {
  signerCertificate: Certificate
  signingTime: Date | null
  chainSubjects: string[]
}

export type X509VerificationResult =
  | { ok: true; value: X509VerificationSuccess }
  | { ok: false; reason: SignatureFailureReason; message: string }

const OID_KEY_USAGE = '2.5.29.15'

const certValidAt = (cert: Certificate, at: Date): boolean => {
  const notBefore = cert.notBefore.value
  const notAfter = cert.notAfter.value
  return at >= notBefore && at <= notAfter
}

const hasRequiredKeyUsage = (cert: Certificate): boolean => {
  const ext = cert.extensions?.find((e) => e.extnID === OID_KEY_USAGE)
  if (!ext?.extnValue) return true
  const hex = ext.extnValue.valueBlock.valueHexView
  if (!hex) return true
  const byte = new Uint8Array(hex)[0] ?? 0
  return (byte & 0x80) !== 0 || (byte & 0x40) !== 0
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const verifyRsaSha1Signature = async (
  signedBytes: Uint8Array,
  signatureBytes: Uint8Array,
  signerCertificate: Certificate
): Promise<boolean> => {
  const spki = signerCertificate.subjectPublicKeyInfo.toSchema().toBER(false)
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      false,
      ['verify']
    )
    return crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(signedBytes)
    )
  } catch {
    return false
  }
}

const orderCertificatesForVerification = async (
  signedBytes: Uint8Array,
  signatureBytes: Uint8Array,
  certificates: Certificate[]
): Promise<Certificate[]> => {
  if (certificates.length <= 1) return certificates

  for (let i = 0; i < certificates.length; i++) {
    if (await verifyRsaSha1Signature(signedBytes, signatureBytes, certificates[i])) {
      return [certificates[i], ...certificates.slice(0, i), ...certificates.slice(i + 1)]
    }
  }

  return certificates
}

export const verifyX509RsaSha1 = async (
  signedBytes: Uint8Array,
  signatureBytes: Uint8Array,
  certificates: Certificate[],
  signingTime: Date | null
): Promise<X509VerificationResult> => {
  if (certificates.length === 0) {
    return { ok: false, reason: 'unsupported-signature', message: 'Missing /Cert in signature dictionary' }
  }

  const ordered = await orderCertificatesForVerification(signedBytes, signatureBytes, certificates)
  const signerCertificate = ordered[0]
  const valid = await verifyRsaSha1Signature(signedBytes, signatureBytes, signerCertificate)
  if (!valid) {
    return { ok: false, reason: 'tampered', message: 'RSA-SHA1 signature is invalid' }
  }

  if (!isUidaiSignerIdentity(signerCertificate)) {
    return { ok: false, reason: 'not-uidai', message: 'Signer identity is not a UIDAI/e-Aadhaar certificate' }
  }

  if (!hasRequiredKeyUsage(signerCertificate)) {
    return {
      ok: false,
      reason: 'unsupported-signature',
      message: 'Signer certificate lacks digitalSignature/nonRepudiation key usage'
    }
  }

  if (!signingTime) {
    return {
      ok: false,
      reason: 'time-unavailable',
      message: 'Signing time (/M) is missing from signature dictionary'
    }
  }

  if (!certValidAt(signerCertificate, signingTime)) {
    return {
      ok: false,
      reason: 'expired-at-signing-time',
      message: 'Signer certificate was not valid at signing time'
    }
  }

  for (const cert of ordered.slice(1)) {
    if (!certValidAt(cert, signingTime)) {
      return {
        ok: false,
        reason: 'expired-at-signing-time',
        message: 'Certificate chain was not valid at signing time'
      }
    }
  }

  const chainEngine = new CertificateChainValidationEngine({
    certs: ordered,
    trustedCerts: getTrustedRootCertificates(),
    checkDate: signingTime
  })

  let chainResult
  try {
    chainResult = await chainEngine.verify({ passedWhenNotRevValues: true })
  } catch {
    return {
      ok: false,
      reason: 'unsupported-signature',
      message: 'Could not parse signer certificate chain from the PDF signature block'
    }
  }

  const chainPath = chainResult.certificatePath?.length
    ? chainResult.certificatePath
    : ordered

  const pinnedFlags = await Promise.all(chainPath.map((cert) => isPinnedTrustedRoot(cert)))
  const hasPinnedRoot = pinnedFlags.some(Boolean)

  if (!chainResult.result && !hasPinnedRoot) {
    return {
      ok: false,
      reason: 'unknown-ca',
      message: 'Certificate chain is not anchored to CCA India 2014/2022 roots'
    }
  }

  return {
    ok: true,
    value: {
      signerCertificate,
      signingTime,
      chainSubjects: chainPath.map((cert) => certificateSubjectPlain(cert))
    }
  }
}
