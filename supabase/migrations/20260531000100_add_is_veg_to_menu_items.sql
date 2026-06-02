-- Migration to add is_veg column to menu_items table (LOW-04)
ALTER TABLE menu_items ADD COLUMN is_veg BOOLEAN DEFAULT true;

-- Update existing menu items with basic non-veg keyword heuristic
UPDATE menu_items 
SET is_veg = false 
WHERE LOWER(name) LIKE '%chicken%' 
   OR LOWER(name) LIKE '%mutton%' 
   OR LOWER(name) LIKE '%egg%' 
   OR LOWER(name) LIKE '%fish%' 
   OR LOWER(name) LIKE '%meat%';
