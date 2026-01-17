-- Check and Reset All User Passwords to "yemisi"
-- This script will:
-- 1. Show current password status for all users
-- 2. Reset all passwords to "yemisi" (bcrypt hash)

-- The bcrypt hash for "yemisi" with 10 salt rounds:
-- $2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a

-- Step 1: Check current users and their password status
SELECT 
    id,
    username,
    email,
    CASE 
        WHEN password_hash IS NULL THEN 'NO PASSWORD'
        WHEN password_hash = '$2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a' THEN 'SET TO YEMISI'
        ELSE 'DIFFERENT PASSWORD'
    END as password_status,
    created_at
FROM profiles 
ORDER BY username;

-- Step 2: Reset all user passwords to "yemisi"
UPDATE profiles 
SET password_hash = '$2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a'
WHERE id IS NOT NULL;

-- Step 3: Verify the update
SELECT 
    id,
    username,
    email,
    CASE 
        WHEN password_hash = '$2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a' THEN 'YES'
        ELSE 'NO'
    END as is_yemisi,
    created_at
FROM profiles 
ORDER BY username;

-- Step 4: Check specific user "icon"
SELECT 
    id,
    username,
    email,
    password_hash,
    CASE 
        WHEN password_hash = '$2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a' THEN 'PASSWORD IS YEMISI'
        WHEN password_hash IS NULL THEN 'NO PASSWORD SET'
        ELSE 'DIFFERENT PASSWORD'
    END as status
FROM profiles 
WHERE username = 'icon'
LIMIT 1;

