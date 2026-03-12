-- Seed sample users
INSERT INTO users (name, email)
VALUES
  ('Alice Johnson', 'alice@example.com'),
  ('Bob Smith', 'bob@example.com')
ON CONFLICT (email) DO NOTHING;
