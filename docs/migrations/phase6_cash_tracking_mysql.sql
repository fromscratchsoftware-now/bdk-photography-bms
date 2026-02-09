-- Phase 6 — Cash Tracking (Approvals + Dashboards)
-- MySQL schema for:
-- - cash_transfers
-- - banking_requests
-- - notifications
--
-- Run in a MySQL 8+ database (utf8mb4).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS cash_transfers (
  id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  sender_user_id VARCHAR(191) NOT NULL,
  receiver_user_id VARCHAR(191) NOT NULL,
  amount_ugx INT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
  request_notes TEXT NULL,
  decision_notes TEXT NULL,
  decided_at TIMESTAMP NULL,
  decided_by_user_id VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY cash_transfers_shop_created_idx (shop_id, created_at),
  KEY cash_transfers_sender_created_idx (sender_user_id, created_at),
  KEY cash_transfers_receiver_created_idx (receiver_user_id, created_at),
  KEY cash_transfers_status_created_idx (status, created_at),
  CONSTRAINT cash_transfers_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cash_transfers_sender_user_id_fk FOREIGN KEY (sender_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cash_transfers_receiver_user_id_fk FOREIGN KEY (receiver_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cash_transfers_decided_by_user_id_fk FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS banking_requests (
  id VARCHAR(191) NOT NULL,
  shop_id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  amount_ugx INT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
  request_notes TEXT NULL,
  decision_notes TEXT NULL,
  decided_at TIMESTAMP NULL,
  decided_by_user_id VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY banking_requests_shop_created_idx (shop_id, created_at),
  KEY banking_requests_user_created_idx (user_id, created_at),
  KEY banking_requests_status_created_idx (status, created_at),
  CONSTRAINT banking_requests_shop_id_fk FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT banking_requests_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT banking_requests_decided_by_user_id_fk FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(191) NOT NULL,
  message TEXT NOT NULL,
  meta_json JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY notifications_user_created_idx (user_id, created_at),
  KEY notifications_user_read_idx (user_id, is_read, created_at),
  CONSTRAINT notifications_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

