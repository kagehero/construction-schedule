-- 取引先メンバーに color カラムを追加（既に customer_members がある場合に実行）
ALTER TABLE customer_members ADD COLUMN IF NOT EXISTS color TEXT;
