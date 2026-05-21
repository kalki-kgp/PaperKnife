/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DecryptPdfError, decryptPdfBytesForInspection } from './decryptPdfBytes'
import { buildRevocationReport } from './embeddedRevocation'
import {
  PdfSignatureParseError,
  extractPdfSignature,
  extractPdfSignatureWithDecryptedContents,
  isSupportedSubFilter,
  isX509RsaSubFilter,
  pdfHasEncryption,
  readSignatureCertificates
} from './pdfSignature'
import { stripPkcs7Padding, verifyDetachedCms } from './pkcs7'
import { certificateSubjectPlain } from './trustStore'
import { verifyX509RsaSha1 } from './x509RsaSha1'
import type { ExtractedPdfSignature, SignatureFailureReason, VerifyUidaiResult } from './types'

const failure = (reason: SignatureFailureReason, message: string): VerifyUidaiResult => ({
  ok: false,
  reason,
  message
})

const extractForVerification = async (
  originalBytes: Uint8Array,
  password?: string
): Promise<ExtractedPdfSignature> => {
  const trimmedPassword = password?.trim() || undefined
  const encrypted = pdfHasEncryption(originalBytes)

  try {
    return extractPdfSignature(originalBytes)
  } catch (rawErr) {
    if (!(rawErr instanceof PdfSignatureParseError)) {
      throw rawErr
    }
    if (!encrypted || !trimmedPassword) {
      throw rawErr
    }

    const decrypted = await decryptPdfBytesForInspection(originalBytes, trimmedPassword)
    if (decrypted === originalBytes) {
      throw rawErr
    }

    try {
      return extractPdfSignature(decrypted)
    } catch {
      return extractPdfSignatureWithDecryptedContents(originalBytes, decrypted, trimmedPassword)
    }
  }
}

export const verifyUidaiPdfSignature = async (
  pdfBytes: Uint8Array,
  password?: string
): Promise<VerifyUidaiResult> => {
  const trimmedPassword = password?.trim() || undefined
  const encrypted = pdfHasEncryption(pdfBytes)

  let extracted: ExtractedPdfSignature
  try {
    extracted = await extractForVerification(pdfBytes, password)
  } catch (err) {
    if (err instanceof DecryptPdfError) {
      return failure('encrypted-copy-needs-password', err.message)
    }

    if (!(err instanceof PdfSignatureParseError)) {
      return failure('unsupported-signature', 'Could not extract PDF signature dictionary')
    }

    if (encrypted && !trimmedPassword) {
      return failure('encrypted-copy-needs-password', err.message)
    }

    if (encrypted && trimmedPassword) {
      return failure(
        'unsupported-signature',
        `Password accepted, but the UIDAI signature block could not be read. ${err.message}`
      )
    }

    return failure('unsupported-signature', err.message)
  }

  if (!isSupportedSubFilter(extracted.subFilter)) {
    return failure('unsupported-signature', `Unsupported SubFilter: ${extracted.subFilter}`)
  }

  if (isX509RsaSubFilter(extracted.subFilter)) {
    let inspectionBytes: Uint8Array | undefined
    if (encrypted && trimmedPassword) {
      try {
        const decrypted = await decryptPdfBytesForInspection(pdfBytes, trimmedPassword)
        if (decrypted !== pdfBytes) inspectionBytes = decrypted
      } catch {
        inspectionBytes = undefined
      }
    }

    let certificates =
      extracted.certificates ??
      (await readSignatureCertificates(
        pdfBytes,
        extracted.dictAnchor ?? extracted.contentsStart,
        trimmedPassword,
        inspectionBytes,
        extracted.byteRange
      ))

    let x509Result
    try {
      x509Result = await verifyX509RsaSha1(
        extracted.signedBytes,
        extracted.signatureBytes,
        certificates,
        extracted.signingTime ?? null
      )
    } catch (err) {
      return failure(
        'unsupported-signature',
        err instanceof Error
          ? err.message
          : 'Could not parse signer certificate chain from the PDF signature block'
      )
    }
    if (!x509Result.ok) {
      return failure(x509Result.reason, x509Result.message)
    }

    const revocation = buildRevocationReport(extracted)

    return {
      ok: true,
      info: {
        signerSubject: certificateSubjectPlain(x509Result.value.signerCertificate),
        signingTime: x509Result.value.signingTime,
        chainSubjects: x509Result.value.chainSubjects,
        revocation
      }
    }
  }

  const cmsBytes = stripPkcs7Padding(extracted.signatureBytes)
  const cmsResult = await verifyDetachedCms(extracted.signedBytes, cmsBytes)
  if (!cmsResult.ok) {
    return failure(cmsResult.reason, cmsResult.message)
  }

  const revocation = buildRevocationReport(extracted, cmsResult.value.signedData)

  return {
    ok: true,
    info: {
      signerSubject: certificateSubjectPlain(cmsResult.value.signerCertificate),
      signingTime: cmsResult.value.signingTime,
      chainSubjects: cmsResult.value.chainSubjects,
      revocation
    }
  }
}

export const failureMessage = (reason: SignatureFailureReason): string => {
  switch (reason) {
    case 'tampered':
      return 'Signature invalid or document bytes were altered.'
    case 'unknown-ca':
      return 'Signer certificate does not chain to a pinned CCA India root.'
    case 'not-uidai':
      return 'Signer is not a UIDAI/e-Aadhaar identity.'
    case 'expired-at-signing-time':
      return 'Certificate was not valid at the recorded signing time.'
    case 'time-unavailable':
      return 'Signing time is unavailable in the signature.'
    case 'unsupported-signature':
      return 'PDF signature format is not supported for offline UIDAI validation.'
    case 'evidence-unavailable-offline':
      return 'Required revocation evidence is not embedded for offline validation.'
    case 'encrypted-copy-needs-password':
      return 'Enter the e-Aadhaar PDF password to read the signature block.'
    default:
      return 'Signature verification failed.'
  }
}
