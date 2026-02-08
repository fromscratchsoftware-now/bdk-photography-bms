-- BDK Photography BMS (v1)
-- MySQL-backed storage for the SiteGround PHP API.
--
-- This stores the entire application state as JSON in a single row, so the existing
-- file-backed API (`data/state.json`) can switch to MySQL with minimal code change.
--
-- Note: You still need to CREATE DATABASE + user in SiteGround first, then configure
-- `BDK_DB_*` in `.env` and set `BDK_STORAGE=mysql`.

CREATE TABLE IF NOT EXISTS bdk_state_store (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

