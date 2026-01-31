# 管理者アカウントの作成手順

## 方法1: Supabaseダッシュボードから作成（推奨）

### ステップ1: ユーザーを作成

1. Supabaseダッシュボードにアクセス
2. 左メニューから **Authentication** → **Users** を選択
3. **Add user** ボタンをクリック
4. **Create new user** を選択
5. 以下の情報を入力:
   - **Email**: `admin@gmail.com`
   - **Password**: `password123!`
   - **Auto Confirm User**: ✅ **チェックを入れる**（重要！）
6. **Create user** をクリック

### ステップ2: 管理者ロールを設定

1. Supabaseダッシュボードで **SQL Editor** を開く
2. 以下のSQLを実行:

```sql
-- ユーザープロファイルを管理者に設定
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'admin@gmail.com';

-- プロファイルが存在しない場合は作成
INSERT INTO user_profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

3. **Run** ボタンをクリックして実行

## 方法2: SQLで直接作成（上級者向け）

```sql
-- 注意: この方法はSupabaseの内部APIを使用します
-- 通常は方法1を使用することを推奨します

-- ユーザーを作成（Supabaseの管理APIを使用する必要があります）
-- 通常はダッシュボードから作成する方が簡単です
```

## 確認方法

ユーザーが正しく作成されたか確認:

```sql
-- ユーザーが存在するか確認
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'admin@gmail.com';

-- プロファイルが正しく設定されているか確認
SELECT id, email, role 
FROM user_profiles 
WHERE email = 'admin@gmail.com';
```

`role` が `admin` になっていることを確認してください。

## トラブルシューティング

### "Invalid login credentials" エラーが出る場合

1. **ユーザーが作成されているか確認**
   - Authentication → Users で `admin@gmail.com` が存在するか確認

2. **パスワードが正しいか確認**
   - パスワードは `password123!` であることを確認
   - コピー&ペースト時に余分なスペースが入っていないか確認

3. **Auto Confirm User が有効か確認**
   - ユーザー詳細ページで確認
   - 無効な場合は、ユーザーを削除して再作成

4. **プロファイルが作成されているか確認**
   - SQL Editorで `SELECT * FROM user_profiles WHERE email = 'admin@gmail.com';` を実行
   - 存在しない場合は、上記のSQLを実行して作成

### ログインは成功するが管理者権限がない場合

- SQL Editorで管理者ロールを設定するSQLを実行
- ブラウザをリロードしてセッションを更新
