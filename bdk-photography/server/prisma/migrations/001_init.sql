-- Phase 1: Foundation schema (MySQL)
-- Created for BDK Photography (shops, users, roles, assignments, audit, reconciliation locks)
-- Charset: utf8mb4

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(191) NOT NULL,
  name ENUM('ADMIN', 'MANAGER', 'SALES') NOT NULL,
  description TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY roles_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shops (
  id VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  code VARCHAR(64) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY shops_code_unique (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(191) NOT NULL,
  full_name VARCHAR(191) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id VARCHAR(191) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_phone_unique (phone),
  KEY users_role_id_idx (role_id),
  CONSTRAINT users_role_id_fk FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_shop_assignment (
  id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TIMESTAMP NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY user_shop_assignment_user_id_idx (user_id),
  KEY user_shop_assignment_shop_id_idx (shop_id),
  CONSTRAINT user_shop_assignment_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT user_shop_assignment_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(191) NOT NULL,
  actor_user_id VARCHAR(191) NULL,
  action VARCHAR(191) NOT NULL,
  entity_type VARCHAR(191) NOT NULL,
  entity_id VARCHAR(191) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY audit_logs_actor_user_id_idx (actor_user_id),
  KEY audit_logs_entity_idx (entity_type, entity_id),
  CONSTRAINT audit_logs_actor_user_id_fk FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reconciliation_locks (
  id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  lock_date DATE NOT NULL,
  locked_by_user_id VARCHAR(191) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY reconciliation_locks_shop_date_unique (shop_id, lock_date),
  KEY reconciliation_locks_locked_by_user_id_idx (locked_by_user_id),
  CONSTRAINT reconciliation_locks_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT reconciliation_locks_locked_by_user_id_fk FOREIGN KEY (locked_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

