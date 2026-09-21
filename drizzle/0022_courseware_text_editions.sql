CREATE TABLE `courseware_text_editions` (
  deck_id TEXT NOT NULL,
  base_version TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  patches_json TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (deck_id, base_version, revision)
);
