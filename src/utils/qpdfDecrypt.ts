/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import createModule, { type QpdfInstance } from '@neslinesli93/qpdf-wasm'
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'

type QpdfFs = QpdfInstance['FS'] & {
  writeFile: (path: string, data: Uint8Array) => void
  unlink: (path: string) => void
}

const INPUT_PATH = '/pk-input.pdf'
const OUTPUT_PATH = '/pk-output.pdf'

let qpdfModulePromise: Promise<QpdfInstance> | null = null

const getQpdfModule = (): Promise<QpdfInstance> => {
  if (!qpdfModulePromise) {
    qpdfModulePromise = createModule({
      locateFile: () => qpdfWasmUrl,
      noInitialRun: true,
    } as Parameters<typeof createModule>[0])
  }
  return qpdfModulePromise
}

const buildDecryptArgs = (password: string | undefined, input: string, output: string): string[] => {
  const args: string[] = []
  if (password !== undefined) {
    args.push(`--password=${password}`)
  }
  args.push(input, '--decrypt', output)
  return args
}

const cleanupFs = (fs: QpdfFs) => {
  for (const path of [INPUT_PATH, OUTPUT_PATH]) {
    try {
      fs.unlink(path)
    } catch {
      // ignore missing paths
    }
  }
}

/**
 * Decrypt / strip encryption with QPDF (lossless — vectors, fonts, and text stay intact).
 */
export const decryptPdfWithQpdf = async (
  pdfBytes: Uint8Array,
  password?: string,
): Promise<Uint8Array> => {
  const qpdf = await getQpdfModule()
  const fs = qpdf.FS as QpdfFs

  const attempts: (string | undefined)[] = []
  if (password) attempts.push(password)
  attempts.push(undefined)
  if (!password) attempts.push('')

  let lastExitCode = 1

  for (const attemptPassword of attempts) {
    cleanupFs(fs)
    fs.writeFile(INPUT_PATH, pdfBytes)
    lastExitCode = qpdf.callMain(buildDecryptArgs(attemptPassword, INPUT_PATH, OUTPUT_PATH))
    if (lastExitCode === 0) {
      const output = new Uint8Array(fs.readFile(OUTPUT_PATH))
      cleanupFs(fs)
      return output
    }
  }

  cleanupFs(fs)
  if (lastExitCode !== 0) {
    throw new Error('Could not decrypt PDF. Check the password and try again.')
  }
  throw new Error('Could not remove encryption. Check the password and try again.')
}
