import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — HealthHub",
  description: "Sign in to HealthHub for personal, facility, doctor, and partner access.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
