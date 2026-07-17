"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLabAuthStore } from "../stores/auth";

const NAV_ITEMS = [
  { href: "/lab-portal/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/lab-portal/bookings", label: "Bookings", icon: "📋" },
  { href: "/lab-portal/catalog", label: "Test Catalog", icon: "🧪" },
  { href: "/lab-portal/packages", label: "Packages", icon: "📦" },
  { href: "/lab-portal/phlebotomists", label: "Phlebotomists", icon: "👨‍⚕️" },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useLabAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/lab-portal/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated()) return null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🧪</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Lab Portal</h2>
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
                    ? "bg-emerald-50 text-emerald-700"
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
              router.push("/lab-portal/login");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
