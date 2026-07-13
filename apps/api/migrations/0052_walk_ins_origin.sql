-- Migration 0052 — walk-ins.origin (Phase QR-Code Check-in)
--
-- Stamp `manual` vs `qr_scan` so the realtime poller + mobile SSE
-- client can distinguish QR-driven check-ins (which fire the mobile
-- "you're checked in" toast) from regular front-desk entries.

ALTER TABLE walk_ins ADD COLUMN origin TEXT DEFAULT 'manual';
