// iPadOS reports a Macintosh user agent too; touch points tell the two apart.
export const isMacDesktop = () =>
  typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints <= 1
