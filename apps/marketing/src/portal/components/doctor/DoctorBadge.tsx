'use client';

import type { DoctorBadgeData } from '@healthcare/shared/doctor-badge';

export function DoctorBadge({ d }: { d: DoctorBadgeData }) {
  return (
    <div className="flex items-center gap-2 border rounded p-2 flex-wrap">
      {d.verifiedSlmc && (
        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
          ✓ SLMC
        </span>
      )}
      <span className="font-medium">{d.name}</span>
      <span className="text-sm text-gray-600">{d.specialty}</span>
      {d.yearsExperience > 0 && (
        <span className="text-xs">{d.yearsExperience}y</span>
      )}
      {d.feeLkr > 0 && (
        <span className="text-xs">LKR {d.feeLkr.toLocaleString()}</span>
      )}
      {d.replyTimeMedianMinutes != null && (
        <span className="text-xs text-blue-700">
          ~{d.replyTimeMedianMinutes}m reply ({d.replyTimeSampleSize})
        </span>
      )}
      {d.hospitalName && (
        <span className="text-xs text-gray-500">· {d.hospitalName}</span>
      )}
    </div>
  );
}
