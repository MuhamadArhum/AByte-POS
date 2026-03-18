-- Migration: Add additional_charges column to purchase_orders
-- Run this if your DB was created before this column was added to schema.sql

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS additional_charges DECIMAL(15, 2) DEFAULT 0,
  MODIFY COLUMN total_amount DECIMAL(15, 2) NOT NULL;
