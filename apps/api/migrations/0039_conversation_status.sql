-- Migration: add status column to messages_conversations
-- "open"   → patient can read and reply
-- "closed" → doctor has ended the thread; patient sees read-only view

ALTER TABLE messages_conversations
  ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
