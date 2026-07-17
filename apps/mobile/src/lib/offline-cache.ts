// @ts-nocheck
// V3: Offline emergency profile + last-known meds cache.
// Backed by expo-secure-store. Read first, network second.

import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";

const KEYS = {
  emergencyProfile: "v3.emergency.profile",
  lastMeds: "v3.medicines.active",
  lastAllergies: "v3.allergies.active",
};

export type CachedEmergencyProfile = {
  fullName?: string | null;
  bloodGroup?: string | null;
  dateOfBirth?: string | null;
  allergies?: { substance: string; severity: string; reaction: string | null }[];
  activeMedicines?: { name: string; dosage: string | null; frequency: string | null }[];
  conditions?: string[];
  emergencyContact?: { name?: string; phone?: string } | null;
  generatedAt: string;
};

async function read<T>(key: string): Promise<T | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (!v) return null;
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

async function write<T>(key: string, value: T) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch {
    // ignore — cache best-effort
  }
}

export async function getEmergencyProfile(): Promise<CachedEmergencyProfile | null> {
  return read<CachedEmergencyProfile>(KEYS.emergencyProfile);
}

export async function setEmergencyProfile(profile: CachedEmergencyProfile) {
  return write(KEYS.emergencyProfile, profile);
}

export async function getLastMeds(): Promise<CachedEmergencyProfile["activeMedicines"]> {
  return (
    (await read<CachedEmergencyProfile["activeMedicines"]>(KEYS.lastMeds)) || []
  );
}

export async function setLastMeds(meds: CachedEmergencyProfile["activeMedicines"]) {
  return write(KEYS.lastMeds, meds);
}

export async function getLastAllergies(): Promise<CachedEmergencyProfile["allergies"]> {
  return (
    (await read<CachedEmergencyProfile["allergies"]>(KEYS.lastAllergies)) || []
  );
}

export async function setLastAllergies(
  list: CachedEmergencyProfile["allergies"]
) {
  return write(KEYS.lastAllergies, list);
}

export async function clearAll() {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.emergencyProfile),
      SecureStore.deleteItemAsync(KEYS.lastMeds),
      SecureStore.deleteItemAsync(KEYS.lastAllergies),
    ]);
    
    // Also clear the general API cache files
    const dir = FileSystem.documentDirectory;
    if (dir) {
      const files = await FileSystem.readDirectoryAsync(dir);
      const cacheFiles = files.filter(f => f.startsWith("api_cache_") && f.endsWith(".json"));
      await Promise.all(cacheFiles.map(f => FileSystem.deleteAsync(`${dir}${f}`, { idempotent: true })));
    }
  } catch {}
}

function getCacheFileUri(endpoint: string): string {
  // Normalize and sanitize endpoint to create a safe local filename
  const cleanEndpoint = endpoint.split("?")[0]; // ignore query string for simple caching key
  const safeName = cleanEndpoint.replace(/^\//, "").replace(/[^a-zA-Z0-9]/g, "_");
  return `${FileSystem.documentDirectory}api_cache_${safeName}.json`;
}

export async function writeApiCache(endpoint: string, data: any): Promise<void> {
  try {
    const fileUri = getCacheFileUri(endpoint);
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (err) {
    // Fail silently - cache is best effort
  }
}

export async function readApiCache<T>(endpoint: string): Promise<T | null> {
  try {
    const fileUri = getCacheFileUri(endpoint);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(content) as T;
  } catch (err) {
    return null;
  }
}
