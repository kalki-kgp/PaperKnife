/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString
} from 'pdf-lib'
import { RC4, aes128CbcDecrypt, md5 } from '@localonlytools/pdf-decrypt'
import { DecryptPdfError } from './decryptPdfBytes'

const PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
])

export type PdfFileEncryptionKey = {
  algorithm: 'RC4' | 'AES-128' | 'AES-256'
  key: Uint8Array
  strFilter: 'V2' | 'AESV2' | 'None'
  revision: number
}

const extractBytes = (pdfObj: unknown): Uint8Array | null => {
  if (!pdfObj) return null
  if (pdfObj instanceof PDFHexString) return pdfObj.asBytes()
  if (pdfObj instanceof PDFString) return pdfObj.asBytes()
  return null
}

const padPassword = (password: string): Uint8Array => {
  const pwdBytes = new TextEncoder().encode(password)
  const padded = new Uint8Array(32)
  if (pwdBytes.length >= 32) {
    padded.set(pwdBytes.slice(0, 32))
  } else {
    padded.set(pwdBytes)
    padded.set(PADDING.slice(0, 32 - pwdBytes.length), pwdBytes.length)
  }
  return padded
}

const arraysEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const computeEncryptionKey = (
  password: string,
  ownerKey: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  revision: number,
  keyLength: number,
  encryptMetadata = true
): Uint8Array => {
  const paddedPwd = padPassword(password)
  const extraLen = revision >= 4 && !encryptMetadata ? 4 : 0
  const hashInput = new Uint8Array(paddedPwd.length + ownerKey.length + 4 + fileId.length + extraLen)
  let offset = 0
  hashInput.set(paddedPwd, offset)
  offset += paddedPwd.length
  hashInput.set(ownerKey, offset)
  offset += ownerKey.length
  hashInput[offset++] = permissions & 0xff
  hashInput[offset++] = (permissions >> 8) & 0xff
  hashInput[offset++] = (permissions >> 16) & 0xff
  hashInput[offset++] = (permissions >> 24) & 0xff
  hashInput.set(fileId, offset)
  offset += fileId.length
  if (revision >= 4 && !encryptMetadata) {
    hashInput[offset++] = 0xff
    hashInput[offset++] = 0xff
    hashInput[offset++] = 0xff
    hashInput[offset++] = 0xff
  }
  let hash = md5(hashInput)
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.slice(0, keyLength))
    }
  }
  return hash.slice(0, keyLength)
}

const validateUserPasswordRc4 = (
  password: string,
  ownerKey: Uint8Array,
  userKey: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  revision: number,
  keyLength: number,
  encryptMetadata: boolean
): Uint8Array | null => {
  const encryptionKey = computeEncryptionKey(
    password,
    ownerKey,
    permissions,
    fileId,
    revision,
    keyLength,
    encryptMetadata
  )
  if (revision === 2) {
    const computed = new RC4(encryptionKey).process(new Uint8Array(PADDING))
    return arraysEqual(computed, userKey) ? encryptionKey : null
  }
  const hashInput = new Uint8Array(PADDING.length + fileId.length)
  hashInput.set(PADDING)
  hashInput.set(fileId, PADDING.length)
  let result = new RC4(encryptionKey).process(md5(hashInput))
  for (let i = 1; i <= 19; i++) {
    const iterKey = new Uint8Array(encryptionKey.length)
    for (let j = 0; j < encryptionKey.length; j++) iterKey[j] = encryptionKey[j] ^ i
    result = new RC4(iterKey).process(result)
  }
  return arraysEqual(result.slice(0, 16), userKey.slice(0, 16)) ? encryptionKey : null
}

const validateOwnerPasswordRc4 = (
  ownerPassword: string,
  ownerKey: Uint8Array,
  userKey: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  revision: number,
  keyLength: number,
  encryptMetadata: boolean
): Uint8Array | null => {
  const paddedOwner = padPassword(ownerPassword)
  let hash = md5(paddedOwner)
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) hash = md5(hash)
  }
  let rc4Key = hash.slice(0, keyLength)
  let recovered = new RC4(rc4Key).process(ownerKey)
  if (revision >= 3) {
    for (let i = 1; i <= 19; i++) {
      const iterKey = new Uint8Array(keyLength)
      for (let j = 0; j < keyLength; j++) iterKey[j] = rc4Key[j] ^ i
      recovered = new RC4(iterKey).process(recovered)
    }
  }
  const recoveredUserPwd = recovered.slice(0, 32)
  return validateUserPasswordRc4(
    String.fromCharCode(...recoveredUserPwd),
    ownerKey,
    userKey,
    permissions,
    fileId,
    revision,
    keyLength,
    encryptMetadata
  )
}

const readEncryptParams = async (pdfBytes: Uint8Array) => {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false })
  const encryptRef = pdfDoc.context.trailerInfo.Encrypt
  if (!encryptRef) return null
  const encryptDict = pdfDoc.context.lookup(encryptRef instanceof PDFRef ? encryptRef : encryptRef)
  if (!(encryptDict instanceof PDFDict)) return null

  const version = Number(encryptDict.get(PDFName.of('V'))?.toString() ?? '0')
  const revision = Number(encryptDict.get(PDFName.of('R'))?.toString() ?? '0')
  const permissions = Number(encryptDict.get(PDFName.of('P'))?.toString() ?? '0')
  const ownerKey = extractBytes(encryptDict.get(PDFName.of('O')))
  const userKey = extractBytes(encryptDict.get(PDFName.of('U')))
  if (!ownerKey || !userKey) return null

  let fileId = new Uint8Array(0)
  const idArray = pdfDoc.context.trailerInfo.ID
  if (Array.isArray(idArray) && idArray.length > 0) {
    const extracted = extractBytes(idArray[0])
    fileId = extracted ? new Uint8Array(extracted) : new Uint8Array(0)
  } else if (idArray instanceof PDFArray) {
    const extracted = extractBytes(idArray.lookup(0))
    fileId = extracted ? new Uint8Array(extracted) : new Uint8Array(0)
  }

  let encryptMetadata = true
  const encryptMetadataObj = encryptDict.get(PDFName.of('EncryptMetadata'))
  if (encryptMetadataObj) {
    encryptMetadata = encryptMetadataObj.toString() !== 'false'
  }

  let algorithm: PdfFileEncryptionKey['algorithm'] = 'RC4'
  let keyLength = 5
  let strFilter: PdfFileEncryptionKey['strFilter'] = 'V2'

  if (version === 5 && revision === 6) {
    algorithm = 'AES-256'
    keyLength = 32
  } else if (version === 4) {
    keyLength = 16
    const CF = encryptDict.get(PDFName.of('CF'))
    const StrF = encryptDict.get(PDFName.of('StrF'))
    const resolveCfm = (filterName: unknown): string => {
      if (!filterName || filterName.toString() === '/Identity') return 'None'
      if (CF instanceof PDFDict) {
        const name = filterName.toString().replace('/', '')
        const filterDict = CF.get(PDFName.of(name))
        if (filterDict instanceof PDFDict) {
          return filterDict.get(PDFName.of('CFM'))?.toString().replace('/', '') ?? 'V2'
        }
      }
      return 'V2'
    }
    const strCfm = resolveCfm(StrF)
    strFilter = strCfm === 'AESV2' ? 'AESV2' : strCfm === 'None' ? 'None' : 'V2'
    algorithm = strFilter === 'AESV2' ? 'AES-128' : 'RC4'
  } else {
    const lengthObj = encryptDict.get(PDFName.of('Length'))
    let keyLengthBits = lengthObj instanceof PDFNumber ? lengthObj.asNumber() : 40
    if (revision >= 3 && !lengthObj) keyLengthBits = 128
    keyLength = keyLengthBits / 8
    algorithm = 'RC4'
  }

  return {
    ownerKey,
    userKey,
    permissions,
    fileId,
    revision,
    keyLength,
    encryptMetadata,
    algorithm,
    strFilter
  }
}

export const getPdfFileEncryptionKey = async (
  pdfBytes: Uint8Array,
  password: string
): Promise<PdfFileEncryptionKey> => {
  const params = await readEncryptParams(pdfBytes)
  if (!params) {
    throw new DecryptPdfError('This PDF is not encrypted.')
  }

  let key =
    validateUserPasswordRc4(
      password,
      params.ownerKey,
      params.userKey,
      params.permissions,
      params.fileId,
      params.revision,
      params.keyLength,
      params.encryptMetadata
    ) ??
    validateOwnerPasswordRc4(
      password,
      params.ownerKey,
      params.userKey,
      params.permissions,
      params.fileId,
      params.revision,
      params.keyLength,
      params.encryptMetadata
    )

  if (!key) {
    throw new DecryptPdfError(
      'Incorrect e-Aadhaar password. Use the same password that opens this PDF in your browser or Adobe Reader.'
    )
  }

  return {
    algorithm: params.algorithm,
    key,
    strFilter: params.strFilter,
    revision: params.revision
  }
}

export const decryptPdfObjectBytes = async (
  data: Uint8Array,
  objectNum: number,
  generationNum: number,
  encryption: PdfFileEncryptionKey
): Promise<Uint8Array> => {
  if (encryption.algorithm === 'AES-128' && encryption.strFilter === 'AESV2') {
    if (data.length < 32) return data
    const keyInput = new Uint8Array(encryption.key.length + 9)
    keyInput.set(encryption.key)
    keyInput[encryption.key.length] = objectNum & 0xff
    keyInput[encryption.key.length + 1] = (objectNum >> 8) & 0xff
    keyInput[encryption.key.length + 2] = (objectNum >> 16) & 0xff
    keyInput[encryption.key.length + 3] = generationNum & 0xff
    keyInput[encryption.key.length + 4] = (generationNum >> 8) & 0xff
    keyInput[encryption.key.length + 5] = 0x73
    keyInput[encryption.key.length + 6] = 0x41
    keyInput[encryption.key.length + 7] = 0x6c
    keyInput[encryption.key.length + 8] = 0x54
    const objectKey = md5(keyInput).slice(0, 16)
    const iv = data.slice(0, 16)
    const ciphertext = data.slice(16)
    if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) return data
    try {
      return await aes128CbcDecrypt(ciphertext, objectKey, iv)
    } catch {
      return data
    }
  }

  const keyInput = new Uint8Array(encryption.key.length + 5)
  keyInput.set(encryption.key)
  keyInput[encryption.key.length] = objectNum & 0xff
  keyInput[encryption.key.length + 1] = (objectNum >> 8) & 0xff
  keyInput[encryption.key.length + 2] = (objectNum >> 16) & 0xff
  keyInput[encryption.key.length + 3] = generationNum & 0xff
  keyInput[encryption.key.length + 4] = (generationNum >> 8) & 0xff
  const objectKey = md5(keyInput).slice(0, Math.min(encryption.key.length + 5, 16))
  return new RC4(objectKey).process(data)
}
