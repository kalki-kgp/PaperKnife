/**
 * PaperKnife - Embedded revocation parsing (Verify Signature, Phase 1)
 * Copyright (C) 2026 kalki-kgp
 *
 * Detects whether the CMS message itself carries OCSP responses or CRLs.
 * Phase 1 only reports presence/absence — actual revocation evaluation is
 * deferred. Critically: this file NEVER reaches out to a network endpoint.
 */

import * as asn1js from 'asn1js'
import { ContentInfo, SignedData } from 'pkijs'

export interface EmbeddedRevocationStatus {
  ocspResponseCount: number
  crlCount: number
}

const OID_REVOCATION_VALUES = '1.2.840.113583.1.1.8'
const OID_ADBE_REVOCATION_INFO_ARCHIVAL = '1.2.840.113583.1.1.8'

export function inspectEmbeddedRevocation(pkcs7Der: Uint8Array): EmbeddedRevocationStatus {
  try {
    const berView = pkcs7Der.buffer.slice(
      pkcs7Der.byteOffset,
      pkcs7Der.byteOffset + pkcs7Der.byteLength,
    ) as ArrayBuffer
    const asn1 = asn1js.fromBER(berView)
    if (asn1.offset === -1) return empty()
    const contentInfo = new ContentInfo({ schema: asn1.result })
    const signedData = new SignedData({ schema: contentInfo.content })

    const crlCount = (signedData.crls || []).length

    let ocspResponseCount = 0
    const signerInfo = signedData.signerInfos?.[0]
    const attrs = signerInfo?.unsignedAttrs?.attributes
    if (attrs) {
      for (const attr of attrs) {
        if (attr.type !== OID_REVOCATION_VALUES && attr.type !== OID_ADBE_REVOCATION_INFO_ARCHIVAL) continue
        // Each value is an OCSPResponse SEQUENCE; we count rather than decode.
        ocspResponseCount += (attr.values?.length || 0)
      }
    }

    return { ocspResponseCount, crlCount }
  } catch {
    return empty()
  }
}

function empty(): EmbeddedRevocationStatus {
  return { ocspResponseCount: 0, crlCount: 0 }
}
