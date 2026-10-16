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
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFString,
  PDFTextField
} from 'pdf-lib'
import { loadPdfDocument, pdfHasEncryptionMarker, stripPdfEncryption } from './pdfHelpers'

export type FormFieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list'
export type FormValue = string | boolean | string[]

export interface FormWidget {
  pageIndex: number
  /** PDF user-space rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number]
  /** Radio buttons only: the option this widget selects. */
  option?: string
}

export interface FormField {
  name: string
  label: string
  kind: FormFieldKind
  value: FormValue
  options: string[]
  multiline: boolean
  maxLength?: number
  readOnly: boolean
  required: boolean
  multiselect: boolean
  editable: boolean
  widgets: FormWidget[]
}

export interface ParsedForm {
  fields: FormField[]
  /** Fields we cannot fill here (signature boxes, push buttons). */
  skippedSignatureFields: number
  hasXfa: boolean
}

export type PreparedForm =
  | { status: 'ready', bytes: Uint8Array }
  | { status: 'needs-password' }

const ANNOT_HIDDEN = 1 << 1
const ANNOT_NO_VIEW = 1 << 5

/**
 * Most fillable government and tax forms carry an owner password that only
 * restricts editing. pdf-lib cannot read encrypted objects at all, so it sees
 * zero fields in those files. Stripping the encryption first (locally, with
 * qpdf) is what makes them fillable.
 */
export const prepareFormBytes = async (file: File, password?: string): Promise<PreparedForm> => {
  const raw = new Uint8Array(await file.arrayBuffer())
  if (!pdfHasEncryptionMarker(raw)) return { status: 'ready', bytes: raw }

  if (!password) {
    try {
      const probe = await loadPdfDocument(file)
      await probe.destroy().catch(() => {})
    } catch (error: any) {
      if (error?.name === 'PasswordException') return { status: 'needs-password' }
      throw error
    }
  }

  return { status: 'ready', bytes: await stripPdfEncryption(file, password) }
}

const decodeTooltip = (field: PDFField): string | undefined => {
  const tu = field.acroField.dict.lookup(PDFName.of('TU'))
  if (tu instanceof PDFString || tu instanceof PDFHexString) {
    const text = tu.decodeText().trim()
    if (text) return text
  }
  return undefined
}

/** "topmostSubform[0].Page1[0].f1_01[0]" -> "f1 01" */
const prettifyName = (name: string): string => {
  const last = name.split('.').pop() || name
  return last.replace(/\[\d+\]$/, '').replace(/[_-]+/g, ' ').trim() || name
}

const kindOf = (field: PDFField): FormFieldKind | null => {
  if (field instanceof PDFTextField) return 'text'
  if (field instanceof PDFCheckBox) return 'checkbox'
  if (field instanceof PDFRadioGroup) return 'radio'
  if (field instanceof PDFDropdown) return 'dropdown'
  if (field instanceof PDFOptionList) return 'list'
  return null
}

const readValue = (field: PDFField, kind: FormFieldKind): FormValue => {
  switch (kind) {
    case 'text': return (field as PDFTextField).getText() ?? ''
    case 'checkbox': return (field as PDFCheckBox).isChecked()
    case 'radio': return (field as PDFRadioGroup).getSelected() ?? ''
    case 'dropdown': return (field as PDFDropdown).getSelected()[0] ?? ''
    case 'list': return (field as PDFOptionList).getSelected()
  }
}

const readOptions = (field: PDFField, kind: FormFieldKind): string[] => {
  if (kind === 'radio') return (field as PDFRadioGroup).getOptions()
  if (kind === 'dropdown') return (field as PDFDropdown).getOptions()
  if (kind === 'list') return (field as PDFOptionList).getOptions()
  return []
}

export const parseForm = async (bytes: Uint8Array): Promise<ParsedForm> => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const form = doc.getForm()

  // Widgets often lack a /P back-reference, so map them from the pages' /Annots.
  const pageOfAnnot = new Map<string, number>()
  doc.getPages().forEach((page, pageIndex) => {
    const annots = page.node.Annots()
    if (!annots) return
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i)
      if (ref instanceof PDFRef) pageOfAnnot.set(ref.toString(), pageIndex)
    }
  })

  const fields: FormField[] = []
  let skippedSignatureFields = 0

  for (const field of form.getFields()) {
    const kind = kindOf(field)
    if (!kind) {
      skippedSignatureFields += 1
      continue
    }

    const options = readOptions(field, kind)
    const widgets: FormWidget[] = []
    field.acroField.getWidgets().forEach((widget, index) => {
      if (widget.hasFlag(ANNOT_HIDDEN) || widget.hasFlag(ANNOT_NO_VIEW)) return
      const ref = doc.context.getObjectRef(widget.dict)
      const parentRef = widget.P()
      const pageIndex = (ref && pageOfAnnot.get(ref.toString()))
        ?? (parentRef ? doc.getPages().findIndex(p => p.ref === parentRef) : -1)
      if (pageIndex === undefined || pageIndex < 0) return
      const { x, y, width, height } = widget.getRectangle()
      widgets.push({
        pageIndex,
        rect: [x, y, x + width, y + height],
        // pdf-lib lists radio options in widget order, so the index lines up.
        option: kind === 'radio' ? options[index] : undefined
      })
    })

    const name = field.getName()
    const textField = kind === 'text' ? field as PDFTextField : null
    const choiceField = kind === 'dropdown' || kind === 'list' ? field as PDFDropdown | PDFOptionList : null

    fields.push({
      name,
      label: decodeTooltip(field) ?? prettifyName(name),
      kind,
      value: readValue(field, kind),
      options,
      multiline: textField?.isMultiline() ?? false,
      maxLength: textField?.getMaxLength(),
      readOnly: field.isReadOnly(),
      required: field.isRequired(),
      multiselect: choiceField?.isMultiselect() ?? false,
      editable: kind === 'dropdown' && (field as PDFDropdown).isEditable(),
      widgets
    })
  }

  return { fields, skippedSignatureFields, hasXfa: form.hasXFA() }
}

const sameValue = (a: FormValue, b: FormValue) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b

export class UnsupportedCharacterError extends Error {
  constructor(public fieldLabel: string, public character: string) {
    super(`"${fieldLabel}" contains "${character}", which this form's font cannot show.`)
    this.name = 'UnsupportedCharacterError'
  }
}

const WIN_ANSI_RE = /WinAnsi cannot encode "(.+?)"/
const AUTO_FONT_SIZE_RE = /(^|\s)0(\.0+)?\s+Tf/
const MULTILINE_AUTO_FONT_SIZE = 10

export const fillForm = async (
  bytes: Uint8Array,
  fields: FormField[],
  values: Record<string, FormValue>,
  { flatten }: { flatten: boolean }
): Promise<{ bytes: Uint8Array, flattened: boolean }> => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const form = doc.getForm()

  // Viewers that understand XFA show its copy of the data and ignore ours.
  if (form.hasXFA()) form.deleteXFA()

  for (const field of fields) {
    const next = values[field.name]
    if (next === undefined || field.readOnly || sameValue(next, field.value)) continue

    try {
      switch (field.kind) {
        case 'text': {
          const textField = form.getTextField(field.name)
          // pdf-lib auto-sizes multiline text to the box height, so "Tf 0"
          // fields end up with one giant clipped word. Cap it like Acrobat does.
          const appearance = textField.acroField.getDefaultAppearance()
          if (field.multiline && (!appearance || AUTO_FONT_SIZE_RE.test(appearance))) {
            textField.setFontSize(MULTILINE_AUTO_FONT_SIZE)
          }
          textField.setText((next as string) || undefined)
          break
        }
        case 'checkbox':
          if (next) form.getCheckBox(field.name).check()
          else form.getCheckBox(field.name).uncheck()
          break
        case 'radio':
          if (next) form.getRadioGroup(field.name).select(next as string)
          else form.getRadioGroup(field.name).clear()
          break
        case 'dropdown':
          if (next) form.getDropdown(field.name).select(next as string)
          else form.getDropdown(field.name).clear()
          break
        case 'list':
          if ((next as string[]).length) form.getOptionList(field.name).select(next as string[])
          else form.getOptionList(field.name).clear()
          break
      }
      // Appearances are regenerated here, one field at a time, so an encoding
      // failure can be pinned to the field that caused it.
      if (field.kind === 'text' || field.kind === 'dropdown' || field.kind === 'list') {
        form.getField(field.name).defaultUpdateAppearances(form.getDefaultFont())
      }
    } catch (error: any) {
      const match = WIN_ANSI_RE.exec(error?.message ?? '')
      if (match) throw new UnsupportedCharacterError(field.label, match[1])
      throw error
    }
  }

  const filled = await doc.save()
  if (!flatten) return { bytes: filled, flattened: false }

  // Flatten a fresh copy: flatten() mutates as it goes, and when malformed
  // widgets make it throw halfway the document is left with fields missing.
  try {
    const flatDoc = await PDFDocument.load(filled, { updateMetadata: false })
    flatDoc.getForm().flatten()
    return { bytes: await flatDoc.save(), flattened: true }
  } catch (error) {
    console.warn('Flatten failed, keeping fields editable:', error)
    return { bytes: filled, flattened: false }
  }
}
