-- FIX: Create trigger to auto-generate session IDs when NULL is inserted
-- This handles cases where PostgresAdapter explicitly inserts NULL

-- Function to generate ID if NULL
CREATE OR REPLACE FUNCTION generate_session_id_if_null()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid()::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_generate_session_id ON sessions;

-- Create trigger BEFORE INSERT to generate ID if NULL
CREATE TRIGGER trg_generate_session_id
  BEFORE INSERT ON sessions
  FOR EACH ROW
  WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION generate_session_id_if_null();

-- Also do the same for users and accounts tables
CREATE OR REPLACE FUNCTION generate_user_id_if_null()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid()::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_user_id ON users;
CREATE TRIGGER trg_generate_user_id
  BEFORE INSERT ON users
  FOR EACH ROW
  WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION generate_user_id_if_null();

CREATE OR REPLACE FUNCTION generate_account_id_if_null()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid()::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_account_id ON accounts;
CREATE TRIGGER trg_generate_account_id
  BEFORE INSERT ON accounts
  FOR EACH ROW
  WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION generate_account_id_if_null();

-- Verify triggers were created
SELECT 
  trigger_name, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('users', 'accounts', 'sessions')
  AND trigger_name LIKE 'trg_generate%'
ORDER BY event_object_table;

