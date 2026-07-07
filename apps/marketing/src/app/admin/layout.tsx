import type { ReactNode } from "react";
import { Providers } from "@/portal/components/Providers";
import { AuthBoot } from "@/portal/components/AuthBoot";
import { ToastHost } from "@/portal/components/ui/Toast";
import "./globals.css";

export const metadata = {
  title: "HealthHub Admin",
  description: "HealthHub platform administration",
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div data-app="admin" className="min-h-screen">
      <Providers>
        <AuthBoot />
        {children}
        <ToastHost />
      </Providers>
    </div>
  );
}