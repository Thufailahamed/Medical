"use client";

// portal/lib/webauthn.ts
//
// Thin wrapper around navigator.credentials.{create,get} for the
// admin passkey flow. Keeps the base64url ↔ ArrayBuffer helpers in
// one place so the manager + modal don't have to repeat them.

function b64urlToBuf(b64: string): ArrayBuffer {
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const b = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Run the registration ceremony and return the credential the
 * server's `/register/verify` endpoint expects.
 */
export async function createPasskey(options: any, deviceName: string) {
  const publicKey = {
    ...options,
    challenge: b64urlToBuf(options.challenge),
    user: {
      ...options.user,
      id: b64urlToBuf(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials ?? []).map((c: any) => ({
      ...c,
      id: b64urlToBuf(c.id),
    })),
  };
  const cred = (await navigator.credentials.create({ publicKey })) as any;
  if (!cred) throw new Error("Passkey creation cancelled");
  return {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      attestationObject: bufToB64url(cred.response.attestationObject),
    },
    deviceName,
  };
}

/**
 * Run the assertion ceremony and return the credential the
 * server's `/auth/verify` endpoint expects.
 */
export async function getPasskey(options: any) {
  const publicKey = {
    ...options,
    challenge: b64urlToBuf(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c: any) => ({
      ...c,
      id: b64urlToBuf(c.id),
    })),
  };
  const cred = (await navigator.credentials.get({ publicKey })) as any;
  if (!cred) throw new Error("Passkey assertion cancelled");
  return {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      authenticatorData: bufToB64url(cred.response.authenticatorData),
      signature: bufToB64url(cred.response.signature),
    },
  };
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials?.create &&
    !!navigator.credentials?.get
  );
}