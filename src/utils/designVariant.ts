/**
 * PaperKnife - Design Variant
 * Canary toggle between three shells:
 *   - 'classic'  : the original warm clay-morphism design (default)
 *   - 'razor'    : a brutalist tech-noir redesign with re-arranged layout
 *   - 'midnight' : the classic layout re-skinned with a modern dark aesthetic
 *
 * Bucketing:
 *   - URL override (?design=...) always wins and persists.
 *   - Otherwise, returns whatever was last persisted in localStorage.
 *   - First-time visitors are bucketed: ROLLOUT_RAZOR % to razor,
 *     ROLLOUT_MIDNIGHT % to midnight, remainder to classic.
 *     The choice is then persisted.
 */

import { useEffect, useState, useCallback } from 'react'

export type DesignVariant = 'classic' | 'razor' | 'midnight'

const STORAGE_KEY = 'pk-design-variant'
const ROLLOUT_RAZOR = 10
const ROLLOUT_MIDNIGHT = 10

const URL_ALIASES: Record<string, DesignVariant> = {
  new: 'razor',
  razor: 'razor',
  noir: 'razor',
  brutal: 'razor',
  old: 'classic',
  classic: 'classic',
  original: 'classic',
  light: 'classic',
  midnight: 'midnight',
  dark: 'midnight',
  obsidian: 'midnight',
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
    return v === 'razor' || v === 'classic' || v === 'midnight' ? v : null
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
  const stored = readStored()
  if (stored) return stored
  const roll = Math.random() * 100
  let v: DesignVariant = 'classic'
  if (roll < ROLLOUT_RAZOR) v = 'razor'
  else if (roll < ROLLOUT_RAZOR + ROLLOUT_MIDNIGHT) v = 'midnight'
  persist(v)
  return v
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
