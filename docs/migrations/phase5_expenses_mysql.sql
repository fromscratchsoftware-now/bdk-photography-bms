-- Phase 5 — Expenses With Payment Source (Cash vs Bank)
-- MySQL schema for:
-- - expenses
--
-- Depends on:
-- - expense_categories (Phase 2)
-- - shops/users (Phase 1)
--
-- Run in a MySQL 8+ database (utf8mb4).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  category_id VARCHAR(191) NOT NULL,
  amount_ugx INT NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT NULL,
  payment_source ENUM('SALESPERSON_CASH', 'ADMIN_BANK') NOT NULL,
  paid_by_user_id VARCHAR(191) NULL,
  recorded_by_user_id VARCHAR(191) NULL,
  is_void TINYINT(1) NOT NULL DEFAULT 0,
  voided_at TIMESTAMP NULL,
  voided_by_user_id VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY expenses_shop_date_idx (shop_id, expense_date),
  KEY expenses_category_idx (category_id),
  KEY expenses_paid_by_user_idx (paid_by_user_id, expense_date),
  CONSTRAINT expenses_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT expenses_category_id_fk FOREIGN KEY (category_id) REFERENCES expense_categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT expenses_paid_by_user_id_fk FOREIGN KEY (paid_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT expenses_recorded_by_user_id_fk FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT expenses_voided_by_user_id_fk FOREIGN KEY (voided_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

