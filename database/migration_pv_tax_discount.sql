-- Migration: Add Tax & Discount columns to inv_purchase_vouchers
-- Run this in HeidiSQL / phpMyAdmin on your existing database

ALTER TABLE inv_purchase_vouchers
  ADD COLUMN discount_percent DECIMAL(5,2)  NOT NULL DEFAULT 0  AFTER other_charges,
  ADD COLUMN discount_amount  DECIMAL(15,2) NOT NULL DEFAULT 0  AFTER discount_percent,
  ADD COLUMN tax_percent      DECIMAL(5,2)  NOT NULL DEFAULT 0  AFTER discount_amount,
  ADD COLUMN tax_amount       DECIMAL(15,2) NOT NULL DEFAULT 0  AFTER tax_percent;
