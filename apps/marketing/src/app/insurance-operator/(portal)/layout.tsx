"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useInsuranceOperatorAuthStore } from "../stores/auth";

const NAV_ITEMS = [
  { href: "/insurance-operator/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/insurance-operator/claims", label: "Claims Queue", icon: "📋" },
  { href: "/insurance-operator/enrollments", label: "Enrollments", icon: "🛡️" },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useInsuranceOperatorAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/insurance-operator/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated()) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Insurance Operator</h2>
              <p className="text-xs text-gray-500 truncate">{user?.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-sky-50 text-sky-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => {
              clearAuth();
              router.push("/insurance-operator/login");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}