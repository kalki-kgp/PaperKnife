/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const VISITED_KEY = 'pk-visited'

const externalReferrerHost = (): string => {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : ''
    return host === location.hostname ? '' : host
  } catch {
    return ''
  }
}

/**
 * Anonymous page count, same-origin only (the CSP allows nothing else).
 * Sends the route, the linking site's hostname on the first page of a tab,
 * and whether the app is installed — never anything about files or the visitor.
 * Only the production host counts, and automated browsers are skipped.
 */
export function VisitPing() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (location.hostname !== 'paperknife.app' || navigator.webdriver) return
    let first = false
    try {
      first = !sessionStorage.getItem(VISITED_KEY)
      sessionStorage.setItem(VISITED_KEY, '1')
    } catch {
      first = false
    }
    fetch('/api/ping', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        kind: first ? 'visit' : 'view',
        ref: first ? externalReferrerHost() : '',
        installed: matchMedia('(display-mode: standalone)').matches
      })
    }).catch(() => {})
  }, [pathname])

  return null
}
