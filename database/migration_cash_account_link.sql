-- Link CPV/CRV to a Cash/Bank account for double-entry balance updates
ALTER TABLE payment_vouchers ADD COLUMN cash_account_id INT NULL AFTER account_id,
  ADD CONSTRAINT fk_pv_cash_account FOREIGN KEY (cash_account_id) REFERENCES accounts(account_id);

ALTER TABLE receipt_vouchers ADD COLUMN cash_account_id INT NULL AFTER account_id,
  ADD CONSTRAINT fk_rv_cash_account FOREIGN KEY (cash_account_id) REFERENCES accounts(account_id);
