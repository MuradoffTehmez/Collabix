-- 0016_task11_schema.sql
-- Adhere to new spec for TASK-11

-- Add show_project_on_profile field
ALTER TABLE users ADD COLUMN show_project_on_profile BOOLEAN DEFAULT 1;

-- Note: active_project_id already exists from 0015 migration.
