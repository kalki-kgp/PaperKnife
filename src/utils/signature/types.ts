/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Certificate } from 'pkijs'

export type SignatureFailureReason =
  | 'tampered'
  | 'unknown-ca'
  | 'not-uidai'
  | 'expired-at-signing-time'
  | 'time-unavailable'
  | 'unsupported-signature'
  | 'evidence-unavailable-offline'
  | 'encrypted-copy-needs-password'

export type ByteRangeTuple = [number, number, number, number]

export interface ExtractedPdfSignature {
  subFilter: string
  byteRange: ByteRangeTuple
  contentsStart: number
  contentsEnd: number
  signatureBytes: Uint8Array
  signedBytes: Uint8Array
  hasDss: boolean
  hasVri: boolean
  certificates?: Certificate[]
  signingTime?: Date | null
  dictAnchor?: number
}

export interface RevocationReport {
  hasEmbeddedOcsp: boolean
  hasEmbeddedCrl: boolean
  ocspSummary: string | null
  crlSummary: string | null
  offlineNote: string
}

export interface VerifiedSignatureInfo {
  signerSubject: string
  signingTime: Date | null
  chainSubjects: string[]
  revocation: RevocationReport
}

export type VerifyUidaiResult =
  | { ok: true; info: VerifiedSignatureInfo }
  | { ok: false; reason: SignatureFailureReason; message: string }

export interface PrintCopyMetadata {
  verified: boolean
  signerLabel: string
  signedAt: Date | null
  inputSha256: string
  revocationNote: string
}
