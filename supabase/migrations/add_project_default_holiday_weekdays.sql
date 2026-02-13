-- 案件ごとのデフォルト週休日を保存するカラムを追加
-- Supabase SQL Editor で実行してください。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS default_holiday_weekdays TEXT;

