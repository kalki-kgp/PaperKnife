/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const PENDING_SHARE_ROUTE = '__paperknife_pending_share__'
const PENDING_SHARE_CACHE = 'paperknife-share-target-v1'
const SHARED_FILE_HEADER = 'X-PaperKnife-Shared-File'
const FILENAME_HEADER = 'X-PaperKnife-Filename'
const SHARED_FILE_READY_MESSAGE = 'paperknife:shared-file-ready'

type LaunchFileHandle = {
  getFile: () => Promise<File>
}

type LaunchParams = {
  files?: LaunchFileHandle[]
}

type LaunchQueue = {
  setConsumer: (consumer: (launchParams: LaunchParams) => void) => void
}

declare global {
  interface Window {
    launchQueue?: LaunchQueue
  }
}

type FileConsumer = (file: File) => void

let launchConsumer: FileConsumer | null = null
let isLaunchQueueRegistered = false
const queuedLaunchFiles: File[] = []

export const isPdfFile = (file: File) => {
  const type = file.type.toLowerCase()
  return type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

const getScopedUrl = (route: string) => {
  const baseUrl = new URL(import.meta.env.BASE_URL || '/', window.location.href)
  return new URL(route, baseUrl).toString()
}

const decodeHeaderValue = (value: string | null) => {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const getPendingSharedResponseFromCache = async () => {
  if (!('caches' in window)) return null

  const cache = await caches.open(PENDING_SHARE_CACHE)
  const requestUrl = getScopedUrl(PENDING_SHARE_ROUTE)
  const response = await cache.match(requestUrl)
  if (!response) return null

  await cache.delete(requestUrl)
  return response
}

const getPendingSharedResponseFromServiceWorker = async () => {
  const requestUrl = getScopedUrl(PENDING_SHARE_ROUTE)
  const response = await fetch(requestUrl, { cache: 'no-store' }).catch(() => null)
  if (!response?.ok || response.headers.get(SHARED_FILE_HEADER) !== '1') return null

  await fetch(requestUrl, { method: 'DELETE' }).catch(() => undefined)
  return response
}

export const consumePendingSharedPdfFile = async () => {
  const response = await getPendingSharedResponseFromCache() || await getPendingSharedResponseFromServiceWorker()
  if (!response || response.headers.get(SHARED_FILE_HEADER) !== '1') return null

  const buffer = await response.arrayBuffer()
  if (!buffer.byteLength) return null

  const name = decodeHeaderValue(response.headers.get(FILENAME_HEADER)) || 'shared.pdf'
  const type = response.headers.get('Content-Type') || 'application/pdf'
  return new File([buffer], name, { type })
}

const publishLaunchFile = (file: File) => {
  if (launchConsumer) {
    launchConsumer(file)
    return
  }

  queuedLaunchFiles.push(file)
}

export const subscribeToLaunchedFiles = (consumer: FileConsumer) => {
  launchConsumer = consumer

  while (queuedLaunchFiles.length > 0) {
    const file = queuedLaunchFiles.shift()
    if (file) consumer(file)
  }

  if (!isLaunchQueueRegistered && window.launchQueue) {
    try {
      window.launchQueue.setConsumer((launchParams) => {
        void (async () => {
          for (const handle of launchParams.files || []) {
            publishLaunchFile(await handle.getFile())
          }
        })()
      })
      isLaunchQueueRegistered = true
    } catch (error) {
      console.warn('PaperKnife file launch consumer failed:', error)
    }
  }

  return () => {
    if (launchConsumer === consumer) launchConsumer = null
  }
}

export const subscribeToSharedFileReady = (onReady: () => void) => {
  if (!('serviceWorker' in navigator)) return () => {}

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === SHARED_FILE_READY_MESSAGE) onReady()
  }

  navigator.serviceWorker.addEventListener('message', handleMessage)
  return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
}
