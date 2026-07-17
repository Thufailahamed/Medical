-- Add Whereby room URLs to teleconsult_sessions
ALTER TABLE teleconsult_sessions ADD COLUMN whereby_room_url TEXT;
ALTER TABLE teleconsult_sessions ADD COLUMN whereby_host_room_url TEXT;
