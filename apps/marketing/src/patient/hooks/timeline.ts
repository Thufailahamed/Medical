"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { TimelineEvent } from "@/patient/types/patient";

export function useTimeline(params: { limit?: number; kinds?: string[] } = {}) {
  return useQuery<{ events: TimelineEvent[] }>({
    queryKey: patientKeys.timeline({ ...params }),
    queryFn: () =>
      api<{ events: TimelineEvent[] }>(patientPaths.timeline.mine(params)),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
