/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { SignedData } from 'pkijs'
import type { ExtractedPdfSignature, RevocationReport } from './types'

const OFFLINE_NOTE = 'No live revocation check in offline mode'

export const buildRevocationReport = (
  extracted: ExtractedPdfSignature,
  signedData?: SignedData
): RevocationReport => {
  const ocspCount = signedData?.ocsps?.length ?? 0
  const crlCount = signedData?.crls?.length ?? 0
  const hasEmbeddedOcsp = ocspCount > 0
  const hasEmbeddedCrl = crlCount > 0 || extracted.hasDss

  return {
    hasEmbeddedOcsp,
    hasEmbeddedCrl,
    ocspSummary: hasEmbeddedOcsp ? `${ocspCount} embedded OCSP response(s) parsed` : null,
    crlSummary: hasEmbeddedCrl
      ? crlCount > 0
        ? `${crlCount} embedded CRL(s) parsed`
        : 'DSS revocation store present'
      : null,
    offlineNote: hasEmbeddedOcsp || hasEmbeddedCrl
      ? 'Embedded revocation evidence present (offline parse only)'
      : OFFLINE_NOTE
  }
}

export const missingEmbeddedEvidenceOnly = (report: RevocationReport): boolean =>
  !report.hasEmbeddedOcsp && !report.hasEmbeddedCrl
