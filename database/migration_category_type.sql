-- Migration: Add category_type, description, is_active to categories table
-- Run this on existing databases

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS category_type ENUM('raw_material','semi_finished','finished_good') NOT NULL DEFAULT 'finished_good' AFTER category_name,
  ADD COLUMN IF NOT EXISTS description TEXT AFTER category_type,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER description,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active;
