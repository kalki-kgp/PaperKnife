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
import { SITE_URL, getRouteSeo, routeSeo } from '../seo'

const INDEXABLE_ROBOTS =
  'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'

const setAttr = (selector: string, attr: string, value: string) => {
  document.head.querySelector(selector)?.setAttribute(attr, value)
}

/**
 * Each route ships a prerendered head from the build, but client-side
 * navigation never reloads the document — without this the landing page's
 * title and canonical would follow the user through the whole app.
 */
export function RouteSeo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const seo = getRouteSeo(pathname)
    const url = pathname === '/' ? `${SITE_URL}/` : `${SITE_URL}${pathname}`

    document.title = seo.title
    setAttr('meta[name="description"]', 'content', seo.description)
    setAttr('link[rel="canonical"]', 'href', url)
    setAttr('meta[property="og:title"]', 'content', seo.title)
    setAttr('meta[property="og:description"]', 'content', seo.description)
    setAttr('meta[property="og:url"]', 'content', url)
    setAttr('meta[name="twitter:title"]', 'content', seo.title)
    setAttr('meta[name="twitter:description"]', 'content', seo.description)
    setAttr(
      'meta[name="robots"]',
      'content',
      routeSeo[pathname]?.noindex ? 'noindex, follow' : INDEXABLE_ROBOTS
    )
  }, [pathname])

  return null
}
