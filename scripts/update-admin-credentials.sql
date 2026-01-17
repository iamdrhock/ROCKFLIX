-- Update admin credentials and add new admin user

-- Update the existing admin user with new password
UPDATE admin_users 
SET 
  password = 'Kinhood99@',
  updated_at = NOW()
WHERE username = 'admin';

-- Insert new admin user if not exists
INSERT INTO admin_users (username, password, created_at, updated_at, failed_login_attempts)
VALUES ('okrjjc@gmail.com', 'Yemisi09@', NOW(), NOW(), 0)
ON CONFLICT (username) DO UPDATE 
SET 
  password = 'Yemisi09@',
  updated_at = NOW();

-- Verify the changes
SELECT id, username, created_at, last_login FROM admin_users ORDER BY id;
