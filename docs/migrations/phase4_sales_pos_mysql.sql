-- Phase 4 — Sales (POS) + Reconciliation Locks
-- MySQL schema for:
-- - sales
-- - sale_lines
--
-- Note: reconciliation_locks table is created in Phase 1 (foundation).
--
-- Run in a MySQL 8+ database (utf8mb4).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  customer_id VARCHAR(191) NULL,
  invoice_id VARCHAR(191) NULL,
  sale_date DATE NOT NULL,
  payment_method ENUM('CASH', 'MOBILE_MONEY', 'CARD', 'CREDIT') NOT NULL,
  total_amount INT NOT NULL,
  notes TEXT NULL,
  is_void TINYINT(1) NOT NULL DEFAULT 0,
  voided_at TIMESTAMP NULL,
  voided_by_user_id VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY sales_shop_date_idx (shop_id, sale_date),
  KEY sales_user_date_idx (user_id, sale_date),
  KEY sales_invoice_id_idx (invoice_id),
  CONSTRAINT sales_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_customer_id_fk FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT sales_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT sales_voided_by_user_id_fk FOREIGN KEY (voided_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sale_lines (
  id VARCHAR(191) NOT NULL,
  sale_id VARCHAR(191) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  product_id VARCHAR(191) NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  product_name VARCHAR(191) NOT NULL,
  quantity INT NOT NULL,
  unit_price INT NOT NULL,
  line_total INT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY sale_lines_sale_id_idx (sale_id),
  KEY sale_lines_product_id_idx (product_id),
  CONSTRAINT sale_lines_sale_id_fk FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT sale_lines_product_id_fk FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

