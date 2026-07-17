// @ts-nocheck
// PACS credential encrypt/decrypt.
//
// Each `hospital_pacs_integrations` row stores the HTTP Basic username
// and password as envelope-encrypted JSON blobs. We use the existing
// `envelope-crypto` helper — same AES-256-GCM shape used by
// `doctors.signing_private_key_enc` — so the KEK rotation path
// (`rewrapUnderKek`) works without a separate codepath.
//
// The kekVersion column is denormalised at write time so a future
// rotation script can `SELECT kek_version, COUNT(*) GROUP BY kek_version`
// to find rows that need to be re-wrapped under the new KEK.

import { audit } from "./audit";
import {
  encryptEnvelope,
  decryptEnvelope,
  type EncryptedPayloadRow,
} from "./envelope-crypto";

export type PacsCredentials = { username: string; password: string };

export type PacsCredentialCipher = {
  /** Cipher row stored on `hospital_pacs_integrations.username_enc` / `password_enc`. */
  row: EncryptedPayloadRow;
  /** Wire id of the KEK that wrapped the DEK. */
  kekVersion: string;
};

/**
 * Encrypt username or password. Returns the cipher row + the KEK wire id
 * so the caller can store both in separate columns.
 */
export async function encryptPacsCredential(
  env: Record<string, unknown>,
  plaintext: string
): Promise<PacsCredentialCipher> {
  const row = await encryptEnvelope(env, plaintext);
  return { row, kekVersion: row.encryptedPayloadKekId };
}

/**
 * Decrypt a credential cipher row. Returns the original plaintext.
 *
 * Accepts either a parsed `EncryptedPayloadRow` object or a JSON string
 * (the on-disk shape — D1 stores text columns verbatim). The JSON-string
 * case is the common read path.
 *
 * Throws `Error("Envelope decryption failed …")` if the row was tampered
 * with or wrapped under a KEK the current env cannot load. Callers must
 * catch + audit + advance the integration's failure counter — never
 * surface the raw error to the API caller (leaks tampering signals).
 */
export async function decryptPacsCredential(
  env: Record<string, unknown>,
  row: EncryptedPayloadRow | string
): Promise<string> {
  const parsed: EncryptedPayloadRow =
    typeof row === "string"
      ? (JSON.parse(row) as EncryptedPayloadRow)
      : row;
  return decryptEnvelope<string>(env, parsed);
}

/**
 * Convenience: decrypt username + password from an integration row.
 * Returns `null` and audits if decryption fails (e.g. KEK rotation gap).
 */
export async function decryptPacsCredentials(
  env: Record<string, unknown>,
  db: any,
  integration: { id: string; usernameEnc: EncryptedPayloadRow; passwordEnc: EncryptedPayloadRow }
): Promise<PacsCredentials | null> {
  try {
    const [username, password] = await Promise.all([
      decryptPacsCredential(env, integration.usernameEnc),
      decryptPacsCredential(env, integration.passwordEnc),
    ]);
    return { username, password };
  } catch (err) {
    await audit(db, {
      action: "pacs_credential_unwrap_failed",
      resource: "hospital_pacs_integration",
      resourceId: integration.id,
      details: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}