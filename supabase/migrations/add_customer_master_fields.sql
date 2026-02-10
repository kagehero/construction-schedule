-- 取引先会社マスターに住所・電話・担当者を追加
-- 既存の customers テーブルがある場合はこれを実行してください。

ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_person TEXT;
