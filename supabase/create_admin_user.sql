-- Create admin user script
-- Run this in Supabase SQL Editor after setting up authentication

-- Step 1: Create the user in Supabase Auth (you can do this via Supabase Dashboard or API)
-- Email: admin@gmail.com
-- Password: password123!

-- Step 2: After creating the user, get their ID and update their profile
-- Replace 'USER_ID_FROM_AUTH_USERS' with the actual user ID

-- Update user profile to admin role
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'admin@gmail.com';

-- If the user profile doesn't exist yet, insert it
-- (This should happen automatically via trigger, but if not, run this)
INSERT INTO user_profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
