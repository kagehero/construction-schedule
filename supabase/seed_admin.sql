-- Create default admin user
-- This script should be run after creating the user in Supabase Auth dashboard
-- or you can use Supabase Auth API to create the user first, then run this

-- First, you need to create the user in Supabase Auth dashboard or via API
-- Email: admin@gmail.com
-- Password: password123!

-- Then, get the user ID from auth.users table and insert into user_profiles
-- Replace 'USER_ID_HERE' with the actual user ID from auth.users

-- Example (run this after creating the user):
-- INSERT INTO user_profiles (id, email, role)
-- SELECT id, email, 'admin'
-- FROM auth.users
-- WHERE email = 'admin@gmail.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Function to automatically create user profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
