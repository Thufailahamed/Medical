import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).max(15).optional(),
  name: z.string().min(2).max(100),
  role: z.enum([
    "patient",
    "doctor",
    "hospital_admin",
    "hospital_staff",
    "laboratory",
    "pharmacy",
    "insurance",
    "ambulance",
  ]),
  password: z.string().min(8),
  nic: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
