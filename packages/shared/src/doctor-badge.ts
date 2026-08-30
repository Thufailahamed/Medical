export type DoctorBadgeData = {
  userId: string;
  name: string;
  specialty: string;
  yearsExperience: number;
  feeLkr: number;
  verifiedSlmc: boolean;
  hospitalName?: string;
  replyTimeMedianMinutes?: number | null;
  replyTimeSampleSize?: number;
};
