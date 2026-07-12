-- Caretaker Profiles: add audit_logs.actor_user_id to record the
-- human who actually performed an action when it differs from userId
-- (the data subject). E.g. caretaker writes a medicine on behalf of a
-- principal → userId = principal.userId, actor_user_id = caretaker.userId.

ALTER TABLE audit_logs ADD COLUMN actor_user_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_user_id, created_at);
