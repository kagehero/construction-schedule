-- 作業班マスター（work_groups）テーブル追加
-- 案件登録時にプルダウンで班を選択する際に使用します。
-- Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS work_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_groups_name ON work_groups(name);

ALTER TABLE work_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view work groups" ON work_groups
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage work groups" ON work_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
