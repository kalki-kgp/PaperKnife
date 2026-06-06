/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

(() => {
  const SHARE_TARGET_ROUTE = 'share-target'
  const PENDING_SHARE_ROUTE = '__paperknife_pending_share__'
  const PENDING_SHARE_CACHE = 'paperknife-share-target-v1'
  const SHARED_FILE_HEADER = 'X-PaperKnife-Shared-File'
  const FILENAME_HEADER = 'X-PaperKnife-Filename'
  const SHARED_AT_HEADER = 'X-PaperKnife-Shared-At'
  const SHARED_FILE_READY_MESSAGE = 'paperknife:shared-file-ready'
  const MAX_PENDING_AGE_MS = 10 * 60 * 1000

  const getRouteWithinScope = (url) => {
    const scopePath = new URL(self.registration.scope).pathname
    const normalizedScope = scopePath.endsWith('/') ? scopePath : `${scopePath}/`
    const path = url.pathname.startsWith(normalizedScope)
      ? url.pathname.slice(normalizedScope.length)
      : url.pathname.replace(/^\/+/, '')

    return path.replace(/^\/+/, '')
  }

  const getScopedUrl = (route) => new URL(route, self.registration.scope).toString()

  const isFileLike = (value) => {
    return value
      && typeof value === 'object'
      && typeof value.arrayBuffer === 'function'
      && typeof value.name === 'string'
  }

  const isPdfFile = (file) => {
    return isFileLike(file)
      && ((file.type || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(file.name))
  }

  const findSharedPdf = (formData) => {
    const files = []
    for (const value of formData.getAll('pdf')) {
      if (isFileLike(value)) files.push(value)
    }

    if (files.length === 0) {
      formData.forEach((value) => {
        if (isFileLike(value)) files.push(value)
      })
    }

    return files.find(isPdfFile) || null
  }

  const purgeExpiredPendingShare = async () => {
    const cache = await caches.open(PENDING_SHARE_CACHE)
    const key = getScopedUrl(PENDING_SHARE_ROUTE)
    const response = await cache.match(key)
    if (!response) return

    const sharedAt = Number(response.headers.get(SHARED_AT_HEADER) || 0)
    if (!sharedAt || Date.now() - sharedAt > MAX_PENDING_AGE_MS) {
      await cache.delete(key)
    }
  }

  const storePendingSharedFile = async (file) => {
    const buffer = await file.arrayBuffer()
    const headers = new Headers({
      'Content-Type': file.type || 'application/pdf',
      [SHARED_FILE_HEADER]: '1',
      [FILENAME_HEADER]: encodeURIComponent(file.name || 'shared.pdf'),
      [SHARED_AT_HEADER]: String(Date.now()),
      'Cache-Control': 'no-store'
    })

    const cache = await caches.open(PENDING_SHARE_CACHE)
    const key = getScopedUrl(PENDING_SHARE_ROUTE)
    await cache.delete(key)
    await cache.put(key, new Response(buffer, { headers }))
  }

  const notifyClients = async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      client.postMessage({ type: SHARED_FILE_READY_MESSAGE })
    }
  }

  const redirectToApp = (error) => {
    const redirectUrl = new URL(self.registration.scope)
    redirectUrl.searchParams.set('shared-file', error ? 'error' : '1')
    if (error) redirectUrl.searchParams.set('reason', error)
    return Response.redirect(redirectUrl.toString(), 303)
  }

  const handleShareTarget = async (request) => {
    try {
      const formData = await request.formData()
      const file = findSharedPdf(formData)
      if (!file) return redirectToApp('unsupported')

      await storePendingSharedFile(file)
      await notifyClients()
      return redirectToApp()
    } catch (error) {
      console.error('PaperKnife share target failed:', error)
      return redirectToApp('failed')
    }
  }

  const readPendingSharedFile = async () => {
    await purgeExpiredPendingShare()

    const cache = await caches.open(PENDING_SHARE_CACHE)
    const response = await cache.match(getScopedUrl(PENDING_SHARE_ROUTE))
    return response || new Response('', { status: 404 })
  }

  const deletePendingSharedFile = async () => {
    const cache = await caches.open(PENDING_SHARE_CACHE)
    await cache.delete(getScopedUrl(PENDING_SHARE_ROUTE))
    return new Response('', { status: 204 })
  }

  self.addEventListener('activate', (event) => {
    event.waitUntil(purgeExpiredPendingShare())
  })

  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)
    const route = getRouteWithinScope(url)

    if (route === SHARE_TARGET_ROUTE && event.request.method === 'POST') {
      event.respondWith(handleShareTarget(event.request))
      return
    }

    if (route === PENDING_SHARE_ROUTE && event.request.method === 'GET') {
      event.respondWith(readPendingSharedFile())
      return
    }

    if (route === PENDING_SHARE_ROUTE && event.request.method === 'DELETE') {
      event.respondWith(deletePendingSharedFile())
    }
  })
})()
