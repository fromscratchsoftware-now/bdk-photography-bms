-- Phase 3 — Customers + Invoicing + Payments (Credit & Installments)
-- MySQL schema for:
-- - customers
-- - shop_invoice_counters
-- - invoices
-- - invoice_lines
-- - invoice_payments
--
-- Run in a MySQL 8+ database (utf8mb4).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(191) NOT NULL,
  mobile VARCHAR(32) NOT NULL,
  first_name VARCHAR(191) NOT NULL,
  last_name VARCHAR(191) NOT NULL,
  email VARCHAR(191) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY customers_mobile_unique (mobile),
  KEY customers_name_idx (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shop_invoice_counters (
  shop_id VARCHAR(191) NOT NULL,
  next_seq INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id),
  CONSTRAINT shop_invoice_counters_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  sequence_number INT NOT NULL,
  invoice_number VARCHAR(64) NOT NULL,
  customer_id VARCHAR(191) NOT NULL,
  status ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID') NOT NULL,
  issued_at TIMESTAMP NULL,
  due_date DATE NULL,
  total_amount INT NOT NULL,
  paid_amount INT NOT NULL DEFAULT 0,
  balance INT NOT NULL,
  notes TEXT NULL,
  created_by_user_id VARCHAR(191) NULL,
  voided_at TIMESTAMP NULL,
  voided_by_user_id VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY invoices_number_unique (invoice_number),
  UNIQUE KEY invoices_shop_seq_unique (shop_id, sequence_number),
  KEY invoices_shop_status_idx (shop_id, status),
  KEY invoices_customer_idx (customer_id),
  CONSTRAINT invoices_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT invoices_customer_id_fk FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT invoices_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT invoices_voided_by_user_id_fk FOREIGN KEY (voided_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id VARCHAR(191) NOT NULL,
  invoice_id VARCHAR(191) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  description VARCHAR(191) NOT NULL,
  quantity INT NOT NULL,
  unit_price INT NOT NULL,
  line_total INT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY invoice_lines_invoice_id_idx (invoice_id),
  CONSTRAINT invoice_lines_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id VARCHAR(191) NOT NULL,
  invoice_id VARCHAR(191) NOT NULL,
  amount INT NOT NULL,
  method ENUM('CASH', 'MOBILE_MONEY', 'CARD') NOT NULL,
  notes TEXT NULL,
  created_by_user_id VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY invoice_payments_invoice_id_idx (invoice_id),
  KEY invoice_payments_created_at_idx (created_at),
  CONSTRAINT invoice_payments_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT invoice_payments_created_by_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

