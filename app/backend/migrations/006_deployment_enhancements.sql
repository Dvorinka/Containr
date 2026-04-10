-- Add missing columns to deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS image_name VARCHAR(500);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS image_tag VARCHAR(100);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS runtime_log TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error TEXT;

-- Add missing columns to services table for compatibility
ALTER TABLE services ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS image VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS command TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS environment VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS git_repo VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS git_branch VARCHAR(100);
ALTER TABLE services ADD COLUMN IF NOT EXISTS build_path VARCHAR(500);
ALTER TABLE services ADD COLUMN IF NOT EXISTS cpu VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS memory VARCHAR(50);

-- Update existing records to have default values
UPDATE services SET type = service_type WHERE type IS NULL;
UPDATE services SET status = 'stopped' WHERE status IS NULL;
UPDATE services SET environment = 'production' WHERE environment IS NULL;
UPDATE services SET cpu = '0.5' WHERE cpu IS NULL;
UPDATE services SET memory = '512Mi' WHERE memory IS NULL;

-- Add index for new columns
CREATE INDEX IF NOT EXISTS idx_deployments_image_name ON deployments(image_name);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
