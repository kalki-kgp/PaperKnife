/**
 * PaperKnife - Design Variant
 * Two shells, user-controlled:
 *   - 'midnight' (default): modern dark aesthetic
 *   - 'classic'           : the original warm clay-morphism design
 *
 * Resolution:
 *   - URL override (?design=...) always wins and persists.
 *   - Otherwise, whatever the user last picked (header toggle) is restored.
 *   - First-time visitors get midnight.
 *
 * Storage key was bumped to migrate canary users who were randomly bucketed
 * to classic — they now land on the new default and can flip back via the
 * header toggle if they prefer.
 */

import { useEffect, useState, useCallback } from 'react'

export type DesignVariant = 'classic' | 'midnight'

const STORAGE_KEY = 'pk-design-choice'

const URL_ALIASES: Record<string, DesignVariant> = {
  old: 'classic',
  classic: 'classic',
  original: 'classic',
  light: 'classic',
  midnight: 'midnight',
  dark: 'midnight',
  new: 'midnight',
  modern: 'midnight',
  cool: 'midnight',
}

function readUrlOverride(): DesignVariant | null {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('design')
    if (!raw) return null
    return URL_ALIASES[raw.toLowerCase()] ?? null
  } catch {
    return null
  }
}

function readStored(): DesignVariant | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'classic' || v === 'midnight' ? v : null
  } catch {
    return null
  }
}

function persist(v: DesignVariant) {
  try {
    localStorage.setItem(STORAGE_KEY, v)
  } catch {}
}

export function resolveInitialVariant(): DesignVariant {
  const url = readUrlOverride()
  if (url) {
    persist(url)
    return url
  }
  return readStored() ?? 'midnight'
}

export function useDesignVariant(): [DesignVariant, (v: DesignVariant) => void] {
  const [variant, setVariant] = useState<DesignVariant>(() => resolveInitialVariant())

  useEffect(() => {
    document.documentElement.setAttribute('data-design', variant)
  }, [variant])

  const update = useCallback((v: DesignVariant) => {
    persist(v)
    setVariant(v)
    document.documentElement.setAttribute('data-design', v)
  }, [])

  return [variant, update]
}
