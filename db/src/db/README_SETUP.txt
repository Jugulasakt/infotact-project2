PostgreSQL setup commands (run in psql as a superuser):

-- 1) Create app user
CREATE USER app_user WITH PASSWORD 'app_password';

-- 2) Create database
CREATE DATABASE app_db OWNER app_user;

-- 3) Grant privileges
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;

-- 4) Connect to app_db, then grant schema/table/sequence permissions
\c app_db
GRANT USAGE, CREATE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 5) Optional default privileges for future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

How to apply project SQL files:
psql -U app_user -d app_db -f src/db/schema.sql
psql -U app_user -d app_db -f src/db/seed.sql
