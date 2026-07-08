"use client";

import { useQuery } from "@tanstack/react-query";

import { api, qk } from "@/hospital/lib/api";

export interface DashboardTile {
  key:
    | "opdToday"
    | "ipdCensus"
    | "beds"
    | "revenueToday"
    | "pendingLabs"
    | "pendingRx"
    | "walkInsWaiting"
    | "lowStock";
  label: string;
  value: number;
  /** Optional denominator or unit shown next to value. */
  total?: number;
  unit?: string;
  /** When false, tile is rendered dimmed with an "available after…" hint. */
  available?: boolean;
  href?: string;
}

export interface DashboardResponse {
  hospital: {
    id: string;
    name: string;
    [k: string]: unknown;
  } | null;
  occupancy: {
    totalBeds: number;
    occupied: number;
    available: number;
    cleaning: number;
    maintenance: number;
    occupancyRate: number;
  };
  shift: "morning" | "evening" | "night";
  staffOnShift: Array<{
    id: string;
    name: string;
    role: string;
    shift?: string;
  }>;
  staffTotals: { total: number; nurses: number; doctors: number };
  admissions: Array<{
    assignmentId: string;
    bedId: string;
    bedNumber: string;
    wardId: string;
    wardName: string;
    patientId: string;
    patientName: string;
    patientPhoto?: string | null;
    assignedAt: string;
  }>;
  tiles: DashboardTile[];
}

/**
 * Wraps GET /hospital-portal/dashboard. Auto-refresh every 30s so the
 * tiles stay roughly current without a manual reload.
 */
export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: qk.dashboard,
    queryFn: () => api<DashboardResponse>("/hospital-portal/dashboard"),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}