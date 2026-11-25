-- Daily anonymous page counts (see worker/index.ts). One row per combination, n counts it.
CREATE TABLE IF NOT EXISTS hits (
  day       TEXT    NOT NULL,           -- YYYY-MM-DD, UTC
  path      TEXT    NOT NULL,           -- an app route, or '(other)'
  ref       TEXT    NOT NULL DEFAULT '',-- linking site's hostname, on visits only
  country   TEXT    NOT NULL,           -- two-letter code from Cloudflare, '??' if unknown
  kind      TEXT    NOT NULL,           -- 'visit' (first page in a tab) or 'view' (later pages)
  installed INTEGER NOT NULL DEFAULT 0, -- 1 when running as the installed app
  n         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, ref, country, kind, installed)
);
