-- Fix: add default UUID generation for menu_items.id
ALTER TABLE menu_items
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
