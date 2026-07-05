"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [role, setRole] = useState<"hospital" | "laboratory">("hospital");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [portalCode, setPortalCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API delay, then route to the appropriate dashboard
    setTimeout(() => {
      setLoading(false);
      if (role === "hospital") {
        router.push("/hospital");
      } else {
        router.push("/laboratory");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-sky-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background blobs to match the premium Aurora effect */}
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Link href="/" className="flex justify-center items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/>
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight font-sans">MedLocker</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight font-serif italic">
          Staff Portal Sign In
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Access your clinical dashboard or laboratory locker
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-sky-800/80 backdrop-blur-sm py-8 px-4 shadow-2xl border border-sky-700/50 sm:rounded-2xl sm:px-10">
          
          {/* Role selector tabs */}
          <div className="flex p-1 bg-sky-900/50 rounded-xl mb-6">
            <button
              onClick={() => setRole("hospital")}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                role === "hospital"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🏥 Hospital Portal
            </button>
            <button
              onClick={() => setRole("laboratory")}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                role === "laboratory"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🔬 Laboratory Portal
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="portal-code" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {role === "hospital" ? "Hospital Registration Code" : "Laboratory Facility ID"}
              </label>
              <div className="mt-2 relative">
                <input
                  id="portal-code"
                  type="text"
                  required
                  placeholder={role === "hospital" ? "HOSP-COLOMBO-04" : "LAB-DURDANS-C3"}
                  value={portalCode}
                  onChange={(e) => setPortalCode(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-sky-700/50 rounded-xl bg-sky-900/50 placeholder-sky-300/50 text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-id" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {role === "hospital" ? "Staff ID / Doctor License" : "Technician ID"}
              </label>
              <div className="mt-2 relative">
                <input
                  id="staff-id"
                  type="text"
                  required
                  placeholder={role === "hospital" ? "SLMC-DR-4819" : "LAB-TECH-7890"}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-sky-700/50 rounded-xl bg-sky-900/50 placeholder-sky-300/50 text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Secret Password Key
              </label>
              <div className="mt-2 relative">
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-sky-700/50 rounded-xl bg-sky-900/50 placeholder-sky-300/50 text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-sky-400 focus:ring-sky-400 border-sky-700 rounded bg-sky-900/50"
                />
                <label htmlFor="remember-me" className="ml-2 text-slate-400">
                  Remember this terminal
                </label>
              </div>

              <div className="text-slate-400">
                <a href="mailto:support@healthhub.app" className="hover:text-white transition-colors underline">
                  Request access
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                  role === "hospital"
                    ? "bg-sky-500 hover:bg-sky-600 focus:ring-sky-500 shadow-sky-500/20"
                    : "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500 shadow-emerald-500/20"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  `Authorize & Enter Dashboard`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Footer copyright */}
      <div className="mt-8 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Healthhub (Pvt) Ltd. All rights reserved.
      </div>
    </div>
  );
}
