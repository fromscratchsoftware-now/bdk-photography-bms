-- Phase 2 — Master Data (No Hard Coding)
-- MySQL schema for:
-- - expense_categories
-- - product_categories
-- - products
--
-- Run in a MySQL 8+ database (utf8mb4).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS expense_categories (
  id VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY expense_categories_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_categories (
  id VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY product_categories_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_units (
  id VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY product_units_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS board_size_codes (
  id VARCHAR(191) NOT NULL,
  code VARCHAR(32) NOT NULL,
  yield_per_sheet INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY board_size_codes_code_unique (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_names (
  id VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY product_names_name_unique (name),
  UNIQUE KEY product_names_sku_code_unique (sku_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(191) NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  category_id VARCHAR(191) NOT NULL,
  product_type ENUM('BOARD', 'NON_BOARD') NOT NULL,
  unit_of_measure VARCHAR(64) NOT NULL,
  cost_price INT NULL,
  selling_price INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  board_size_code ENUM('A4C', 'A3C', 'A2C') NULL,
  yield_per_sheet INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY products_sku_code_unique (sku_code),
  KEY products_category_id_idx (category_id),
  CONSTRAINT products_category_id_fk FOREIGN KEY (category_id) REFERENCES product_categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
