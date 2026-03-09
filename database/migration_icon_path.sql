-- Migration: Add icon_path column to map_poi_categories
-- Date: 2025-10-05
-- Description: Add icon_path column to store SVG file paths instead of relying on Material Symbols font

BEGIN;

-- Add icon_path column
ALTER TABLE map_poi_categories 
ADD COLUMN IF NOT EXISTS icon_path TEXT;

-- Update existing data with SVG paths
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/cycling.svg' WHERE icon = 'cycling';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/camping.svg' WHERE icon = 'camping';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/kayaking.svg' WHERE icon = 'kayaking';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/bird.svg' WHERE icon = 'bird';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/fishing.svg' WHERE icon = 'fishing';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/trailhead.svg' WHERE icon = 'trailhead';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/parking.svg' WHERE icon = 'parking';
UPDATE map_poi_categories SET icon_path = '/assets/icons/categories/restroom.svg' WHERE icon = 'restroom';

-- Set default for any future categories without icon_path
UPDATE map_poi_categories 
SET icon_path = '/assets/icons/categories/default.svg' 
WHERE icon_path IS NULL;

COMMIT;
