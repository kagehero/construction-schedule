-- work_groups.name を一意にする制約を追加
-- Supabase SQL Editor で実行してください。

ALTER TABLE work_groups
  ADD CONSTRAINT work_groups_name_unique UNIQUE (name);

