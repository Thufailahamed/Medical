// @ts-nocheck

// Reusable trust signal for SLMC-verified doctors.
// Renders nothing when `verified` is false. When true, shows a small
// blue Pill with a checkmark + "SLMC verified" + optional reg no.
//
// Use:
//   <VerifiedBadge verified={!!doctor.slmcVerifiedAt} regNo={doctor.slmcRegistrationNo} />
//
// The `regNo` is shown below the main label as a hint to the patient
// that the registration number is verifiable via SLMC's own register.

import { BadgeCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pill } from "./Pill";

type Props = {
  verified: boolean;
  regNo?: string | null;
  size?: "sm" | "md";
};

export function VerifiedBadge({ verified, regNo, size = "sm" }: Props) {
  const { t } = useTranslation();
  if (!verified) return null;

  return (
    <Pill
      label={t("verifiedBadge.verified")}
      icon={BadgeCheck}
      tone="info"
      size={size}
    />
  );
}

// Variant that also exposes the registration number, useful on detail
// screens where the patient needs to verify credentials.
export function VerifiedBadgeWithRegNo({
  verified,
  regNo,
}: {
  verified: boolean;
  regNo?: string | null;
}) {
  const { t } = useTranslation();
  if (!verified) return null;
  return (
    <Pill
      label={`${t("verifiedBadge.verified")}${regNo ? ` · ${regNo}` : ""}`}
      icon={BadgeCheck}
      tone="info"
      size="sm"
    />
  );
}
