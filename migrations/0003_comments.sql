-- Comments on a page, or on one passage of it. A reader is a random id, as with
-- hearts and highlights. The name is optional: NULL shows as "someone from …".
-- quote and start are the selected text and its character offset inside the
-- page's article (the same offset highlights use). Both NULL: the whole page.
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  visitor TEXT NOT NULL,
  name TEXT,
  body TEXT NOT NULL,
  quote TEXT,
  start INTEGER,
  city TEXT,
  country TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK ((quote IS NULL) = (start IS NULL))
);
CREATE INDEX comments_slug ON comments (slug, created_at);
