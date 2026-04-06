BEGIN;

-- 清空旧数据，并重置主键自增
TRUNCATE TABLE map_points_of_interest RESTART IDENTITY CASCADE;
TRUNCATE TABLE map_poi_categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE map_trail_segments RESTART IDENTITY CASCADE;

-- 1) Trail segments
INSERT INTO map_trail_segments (name, status, description, is_public, sort_index, geojson) VALUES
  (
    'Existing Lakeside Trail',
    'existing',
    'Fully constructed sections that are open to the public year-round.',
    TRUE,
    1,
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Existing Lakeside Trail"},"geometry":{"type":"LineString","coordinates":[[172.14,-43.68],[172.18,-43.7],[172.22,-43.71],[172.26,-43.73],[172.29,-43.74],[172.33,-43.75],[172.37,-43.76]]}}]}'::jsonb
  ),
  (
    'Stage 1 – Lakeside Boardwalk',
    'stage-1',
    'Currently under construction with new boardwalks and upgraded surfacing.',
    TRUE,
    2,
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Stage 1 – Lakeside Boardwalk"},"geometry":{"type":"LineString","coordinates":[[172.37,-43.76],[172.41,-43.78],[172.45,-43.79],[172.49,-43.81]]}}]}'::jsonb
  ),
  (
    'Stage 2 – Coastal Wetland',
    'stage-2',
    'Future section pending consents; alignment may change following consultation.',
    TRUE,
    3,
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Stage 2 – Coastal Wetland"},"geometry":{"type":"LineString","coordinates":[[172.49,-43.81],[172.53,-43.83],[172.57,-43.84],[172.61,-43.86]]}}]}'::jsonb
  ),
  (
    'Wetland Discovery Loop',
    'stage-2',
    'Concept-only loop through new wetland plantings. Hidden from public map until confirmed.',
    FALSE,
    4,
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Wetland Discovery Loop"},"geometry":{"type":"LineString","coordinates":[[172.3,-43.74],[172.32,-43.73],[172.35,-43.72],[172.33,-43.71],[172.3,-43.72]]}}]}'::jsonb
  );

-- 2) POI categories（顺序与原数据一致，生成的 ID 依次对应 cycling…amenity）
INSERT INTO map_poi_categories (label, icon, icon_path, group_name, default_visible, sort_index) VALUES
  ('Cycling', 'cycling', '/assets/icons/categories/cycling.svg', 'Activities', TRUE, 0),
  ('Camping', 'camping', '/assets/icons/categories/camping.svg', 'Activities', TRUE, 1),
  ('Kayaking', 'kayaking', '/assets/icons/categories/kayaking.svg', 'Activities', TRUE, 2),
  ('Birdwatching', 'bird', '/assets/icons/categories/bird.svg', 'Activities', TRUE, 3),
  ('Fishing', 'fishing', '/assets/icons/categories/fishing.svg', 'Activities', TRUE, 4),
  ('Trailhead', 'trailhead', '/assets/icons/categories/trailhead.svg', 'Access & Facilities', TRUE, 5),
  ('Car Park', 'parking', '/assets/icons/categories/parking.svg', 'Access & Facilities', TRUE, 6),
  ('Public Amenities', 'restroom', '/assets/icons/categories/restroom.svg', 'Access & Facilities', FALSE, 7);

-- 3) POIs（category_id 依赖上面的插入顺序：1=cycling, 2=camping, …, 8=amenity）
INSERT INTO map_points_of_interest (
    category_id,
    name,
    description,
    lat,
    lng,
    image_url,
    gmaps_url,
    is_public,
    sort_index
) VALUES
  (1, 'Kaituna Riverside Ride', 'Smooth gravel riding beside the Kaituna River with views across Te Waihora.', -43.75, 172.35, 'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=600&h=400&q=60', NULL, TRUE, 0),
  (4, 'Yarrs Flat Bird Sanctuary', 'Boardwalk and hides that overlook one of the lake''s most active bird rookeries.', -43.79, 172.26, 'https://images.unsplash.com/photo-1501706362039-c6e80948c98d?auto=format&fit=crop&w=600&h=400&q=60', NULL, TRUE, 1),
  (2, 'Greenpark Sands Camp', 'Basic lakeside campsite with flat tent sites and access to the shoreline.', -43.78, 172.36, 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&h=400&q=60', 'https://www.google.com/maps/dir/?api=1&destination=-43.78,172.36', TRUE, 2),
  (5, 'Harts Creek Fishing Jetty', 'Popular shore fishing jetty with calm waters and seasonal whitebait runs.', -43.81, 172.44, 'https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?auto=format&fit=crop&w=600&h=400&q=60', 'https://www.google.com/maps/dir/?api=1&destination=-43.81,172.44', TRUE, 3),
  (3, 'Coopers Lagoon Kayak Launch', 'Easy kayak launch with gentle shoreline and sheltered waters for families.', -43.84, 172.52, 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&h=400&q=60', 'https://www.google.com/maps/dir/?api=1&destination=-43.84,172.52', TRUE, 4),
  (6, 'Lakeview Road Trailhead', 'Primary northern entry point with trail information board and bike racks.', -43.72, 172.28, 'https://images.unsplash.com/photo-1528490060255-bf65fc2c9fa3?auto=format&fit=crop&w=600&h=400&q=60', 'https://www.google.com/maps/dir/?api=1&destination=-43.72,172.28', TRUE, 5),
  (7, 'Birdlings Flat Car Park', 'Sealed parking with space for shuttles and trailer turnarounds near the southern coast.', -43.85, 172.72, 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=600&h=400&q=60', 'https://www.google.com/maps/dir/?api=1&destination=-43.85,172.72', TRUE, 6),
  (8, 'Leeston Domain Amenities', 'Public restrooms, picnic tables, and water refill station a short detour from the trail.', -43.76, 172.30, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&h=400&q=60', 'https://www.google.com/maps/dir/?api=1&destination=-43.76,172.30', TRUE, 7);

COMMIT;
