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
import {
  Certificate,
  ContentInfo,
  SignedData,
  type SignedDataVerifyResult
} from 'pkijs'

const OID_SIGNING_TIME = '1.2.840.113549.1.9.5'
import {
  certificateSubjectPlain,
  getTrustedRootCertificates,
  isPinnedTrustedRoot,
  isUidaiSignerIdentity
} from './trustStore'
import type { SignatureFailureReason } from './types'

export interface CmsVerificationSuccess {
  signedData: SignedData
  signerCertificate: Certificate
  signingTime: Date | null
  chainSubjects: string[]
}

export type CmsVerificationResult =
  | { ok: true; value: CmsVerificationSuccess }
  | { ok: false; reason: SignatureFailureReason; message: string }

const OID_KEY_USAGE = '2.5.29.15'

const readSigningTime = (signedData: SignedData): Date | null => {
  const signer = signedData.signerInfos[0]
  if (!signer?.signedAttrs?.attributes) return null
  for (const attr of signer.signedAttrs.attributes) {
    if (attr.type !== OID_SIGNING_TIME) continue
    const values = attr.values
    if (!values?.length) continue
    const value = values[0]
    if (value instanceof Date) return value
    const block = value.valueBlock as { toDate?: () => Date; value?: Date }
    if (typeof block.toDate === 'function') return block.toDate()
    if (block.value instanceof Date) return block.value
  }
  return null
}

const hasRequiredKeyUsage = (cert: Certificate): boolean => {
  const ext = cert.extensions?.find((e) => e.extnID === OID_KEY_USAGE)
  if (!ext?.extnValue) return true
  const parsed = fromBER(ext.extnValue.valueBlock.valueHexView)
  const bitString = parsed.result as { valueBlock?: { valueHex?: ArrayBuffer } }
  const hex = bitString.valueBlock?.valueHex
  if (!hex) return true
  const byte = new Uint8Array(hex)[0] ?? 0
  const digitalSignature = (byte & 0x80) !== 0
  const nonRepudiation = (byte & 0x40) !== 0
  return digitalSignature || nonRepudiation
}

const certValidAt = (cert: Certificate, at: Date): boolean => {
  const notBefore = cert.notBefore.value
  const notAfter = cert.notAfter.value
  return at >= notBefore && at <= notAfter
}

const mapVerifyError = (result: SignedDataVerifyResult): CmsVerificationResult => {
  if (result.signatureVerified === false) {
    return { ok: false, reason: 'tampered', message: 'Detached CMS signature is invalid' }
  }
  if (result.signerCertificateVerified === false) {
    return { ok: false, reason: 'unknown-ca', message: 'Signer chain does not anchor to a pinned CCA India root' }
  }
  return { ok: false, reason: 'tampered', message: result.message || 'CMS verification failed' }
}

export const parseSignedData = (signatureBytes: Uint8Array): SignedData => {
  const cmsBuffer = signatureBytes.buffer.slice(
    signatureBytes.byteOffset,
    signatureBytes.byteOffset + signatureBytes.byteLength
  ) as ArrayBuffer
  const cms = ContentInfo.fromBER(cmsBuffer)
  if (cms.contentType !== ContentInfo.SIGNED_DATA) {
    throw new Error('CMS content is not SignedData')
  }
  return new SignedData({ schema: cms.content })
}

export const verifyDetachedCms = async (
  signedBytes: Uint8Array,
  signatureBytes: Uint8Array
): Promise<CmsVerificationResult> => {
  let signedData: SignedData
  try {
    signedData = parseSignedData(signatureBytes)
  } catch {
    return { ok: false, reason: 'unsupported-signature', message: 'Could not parse PKCS#7 SignedData' }
  }

  const signingTime = readSigningTime(signedData)
  const checkDate = signingTime ?? undefined

  let verifyResult: SignedDataVerifyResult
  try {
    verifyResult = await signedData.verify({
      signer: 0,
      data: signedBytes.buffer.slice(
        signedBytes.byteOffset,
        signedBytes.byteOffset + signedBytes.byteLength
      ) as ArrayBuffer,
      trustedCerts: getTrustedRootCertificates(),
      checkChain: true,
      checkDate,
      extendedMode: true,
      passedWhenNotRevValues: true
    })
  } catch (err) {
    if (err instanceof Error && 'signatureVerified' in err) {
      verifyResult = err as unknown as SignedDataVerifyResult
    } else {
      return { ok: false, reason: 'tampered', message: 'CMS verification failed' }
    }
  }

  if (verifyResult.signatureVerified === false) {
    return mapVerifyError(verifyResult)
  }

  const signerCertificate = verifyResult.signerCertificate
  if (!signerCertificate) {
    return { ok: false, reason: 'tampered', message: 'Signer certificate missing from CMS' }
  }

  const chain = verifyResult.certificatePath?.length
    ? verifyResult.certificatePath
    : [signerCertificate]

  const chainAnchorsPinned = await Promise.all(
    chain.map((cert) => isPinnedTrustedRoot(cert))
  )
  const hasPinnedRoot = chainAnchorsPinned.some(Boolean)
  if (!hasPinnedRoot && verifyResult.signerCertificateVerified === false) {
    return { ok: false, reason: 'unknown-ca', message: 'Certificate chain is not anchored to CCA India 2014/2022 roots' }
  }

  if (!isUidaiSignerIdentity(signerCertificate)) {
    return { ok: false, reason: 'not-uidai', message: 'Signer identity is not a UIDAI/e-Aadhaar certificate' }
  }

  if (!hasRequiredKeyUsage(signerCertificate)) {
    return { ok: false, reason: 'unsupported-signature', message: 'Signer certificate lacks digitalSignature/nonRepudiation key usage' }
  }

  const validityInstant = signingTime
  if (!validityInstant) {
    return { ok: false, reason: 'time-unavailable', message: 'Signing time attribute is missing from CMS' }
  }

  if (!certValidAt(signerCertificate, validityInstant)) {
    return { ok: false, reason: 'expired-at-signing-time', message: 'Signer certificate was not valid at signing time' }
  }

  for (const cert of chain) {
    if (!certValidAt(cert, validityInstant)) {
      return { ok: false, reason: 'expired-at-signing-time', message: 'Certificate chain was not valid at signing time' }
    }
  }

  return {
    ok: true,
    value: {
      signedData,
      signerCertificate,
      signingTime,
      chainSubjects: chain.map((c) => certificateSubjectPlain(c))
    }
  }
}

export const stripPkcs7Padding = (signatureBytes: Uint8Array): Uint8Array => {
  let end = signatureBytes.length
  while (end > 0 && signatureBytes[end - 1] === 0) end -= 1
  return end === signatureBytes.length ? signatureBytes : signatureBytes.subarray(0, end)
}
