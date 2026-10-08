-- +goose Up
-- Volume mounts on services: [{type: "volume"|"bind", source, target,
-- read_only}]. Applied to every replica's container config at deploy and
-- reconcile time. The baseline schema declared the column nullable with
-- no default — this normalizes it.
ALTER TABLE services ADD COLUMN IF NOT EXISTS volumes JSONB DEFAULT '[]'::jsonb;
UPDATE services SET volumes = '[]'::jsonb WHERE volumes IS NULL;
ALTER TABLE services ALTER COLUMN volumes SET DEFAULT '[]'::jsonb;
ALTER TABLE services ALTER COLUMN volumes SET NOT NULL;

-- +goose Down
ALTER TABLE services ALTER COLUMN volumes DROP NOT NULL;
ALTER TABLE services ALTER COLUMN volumes DROP DEFAULT;
