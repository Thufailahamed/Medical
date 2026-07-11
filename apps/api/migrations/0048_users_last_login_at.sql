-- Phase ADM-3: track last login time per user for admin views.
ALTER TABLE users ADD COLUMN last_login_at TEXT;