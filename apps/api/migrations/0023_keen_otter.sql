-- Phase MFA (Round 2 P0): TOTP-based second factor for doctors.
--
-- Adds envelope-encrypted TOTP secret storage + recovery-code hashes
-- to the doctors row. Wire format mirrors signing keys: AES-256-GCM
-- ciphertext under env.MFA_SECRET_KEK, format `v1:<iv_b64>:<ct_b64>`
-- (see lib/mfa.ts).
--
-- Recovery codes are 10 single-use backups presented to the doctor
-- after enrollment. We store SHA-256 hashes (pepper + code) instead
-- of plaintext; consumed codes move into mfa_recovery_used_codes.

ALTER TABLE doctors ADD COLUMN mfa_secret_enc text;
ALTER TABLE doctors ADD COLUMN mfa_enabled integer DEFAULT 0 NOT NULL;
ALTER TABLE doctors ADD COLUMN mfa_recovery_codes_hash text;
ALTER TABLE doctors ADD COLUMN mfa_recovery_used_codes text;
ALTER TABLE doctors ADD COLUMN mfa_enrolled_at text;
