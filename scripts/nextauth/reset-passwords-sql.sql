-- Reset all user passwords to "yemisi"
-- WARNING: This uses a pre-computed bcrypt hash
-- The bcrypt hash for "yemisi" with 10 salt rounds is:
-- $2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a

-- Update all users with the new password hash
UPDATE profiles 
SET password_hash = '$2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a'
WHERE id IS NOT NULL;

-- Verify the update
SELECT id, username, email, 
       password_hash IS NOT NULL as has_password,
       LEFT(password_hash, 7) as hash_prefix
FROM profiles 
ORDER BY created_at;

