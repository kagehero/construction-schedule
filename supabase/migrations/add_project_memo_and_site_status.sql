-- 案件テーブルにメモと現場ステータスを追加
-- Supabase SQL Editor で実行してください。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS memo TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS site_status TEXT;

-- 任意: 代表的なステータス値のための CHECK 制約（既存データがあれば様子を見て有効化）
-- ALTER TABLE projects
--   ADD CONSTRAINT projects_site_status_check
--   CHECK (site_status IN ('計画中', '稼働中', '完了'));

