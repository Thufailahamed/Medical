"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Patient {
  id: string;
  name: string;
  nic: string;
  age: number;
  time: string;
  status: "Waiting" | "In Consultation" | "Completed";
  reason: string;
  lang: "SI" | "TA" | "EN";
}

export default function HospitalPortal() {
  const [patients, setPatients] = useState<Patient[]>([
    { id: "P001", name: "Anura Wijesinghe", nic: "1994208311V", age: 32, time: "14:15", status: "In Consultation", reason: "Cardiology Review", lang: "SI" },
    { id: "P002", name: "Fathima Rizan", nic: "1988583922V", age: 38, time: "14:30", status: "Waiting", reason: "Blood Pressure Check", lang: "TA" },
    { id: "P003", name: "Shanmugam Pillai", nic: "1965103444V", age: 61, time: "14:40", status: "Waiting", reason: "Diabetes Follow-up", lang: "TA" },
    { id: "P004", name: "David Miller", nic: "20011883921", age: 25, time: "14:50", status: "Waiting", reason: "Vaccination Boost", lang: "EN" }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"queue" | "doctors">("queue");

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nic.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-[#070D19] text-white flex flex-col font-sans relative">
      {/* Premium background radial highlights */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-[#0A1220]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">MedLocker</span>
          </Link>
          <span className="h-4 w-px bg-slate-800" />
          <span className="text-xs font-semibold bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full border border-sky-500/15">
            🏥 DURDANS CLINIC PORTAL
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white">Dr. K. Perera</div>
            <div className="text-xs text-slate-400">Cardiology Specialist</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#16223F] border border-sky-500/30 flex items-center justify-center font-bold text-sky-400">
            KP
          </div>
          <Link href="/login" className="text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-[#111A2E] hover:bg-[#16223F] border border-slate-800 px-3.5 py-2 rounded-xl">
            Sign out
          </Link>
        </div>
      </header>

      {/* Main Content container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all group">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Checked In Today</div>
            <div className="mt-2 text-3xl font-extrabold text-white flex items-baseline gap-2">
              42 <span className="text-xs font-medium text-emerald-400">+4 new</span>
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Waitlists synced with MedLocker App</div>
          </div>
          <div className="bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Queue</div>
            <div className="mt-2 text-3xl font-extrabold text-sky-400">
              8 <span className="text-xs font-medium text-slate-400">patients waiting</span>
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Avg. wait time: 14 mins</div>
          </div>
          <div className="bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">E-Prescriptions Sent</div>
            <div className="mt-2 text-3xl font-extrabold text-emerald-400">
              24
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Directly pushed to patient phone locks</div>
          </div>
          <div className="bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">NIC Verification Rate</div>
            <div className="mt-2 text-3xl font-extrabold text-coral-400" style={{ color: "#FF7A59" }}>
              96%
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Soft matches completed instantly</div>
          </div>
        </div>

        {/* Dashboard Grid split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Columns - Active Queue */}
          <div className="lg:col-span-2 bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-6 flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight font-serif italic">Patient Admission Queue</h3>
                <p className="text-xs text-slate-400 mt-1">Real-time check-in and clinic status tracking</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTab("queue")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "queue" 
                      ? "bg-sky-500 text-white" 
                      : "bg-[#090F1B] text-slate-400 hover:text-white"
                  }`}
                >
                  Active Queue
                </button>
                <button 
                  onClick={() => setActiveTab("doctors")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "doctors" 
                      ? "bg-sky-500 text-white" 
                      : "bg-[#090F1B] text-slate-400 hover:text-white"
                  }`}
                >
                  Doctor Shifts
                </button>
              </div>
            </div>

            {/* Search Input bar */}
            <div className="mb-6 relative">
              <input
                type="text"
                placeholder="Search patient by name or NIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-[#090F1B] border border-slate-800 rounded-xl placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-sans"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">🔍</span>
            </div>

            {activeTab === "queue" ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Patient & NIC</th>
                      <th className="pb-3 font-semibold">Check-in Time</th>
                      <th className="pb-3 font-semibold">Preferred Language</th>
                      <th className="pb-3 font-semibold">Reason</th>
                      <th className="pb-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id} className="group hover:bg-[#16223F]/20 transition-all">
                        <td className="py-4">
                          <div className="font-semibold text-white group-hover:text-sky-400 transition-colors">{patient.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{patient.nic} · {patient.age} yrs</div>
                        </td>
                        <td className="py-4 text-slate-300 font-mono">{patient.time}</td>
                        <td className="py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            patient.lang === "SI" 
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                              : patient.lang === "TA" 
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          }`}>
                            {patient.lang === "SI" ? "Sinhala" : patient.lang === "TA" ? "Tamil" : "English"}
                          </span>
                        </td>
                        <td className="py-4 text-slate-300">{patient.reason}</td>
                        <td className="py-4 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            patient.status === "In Consultation" 
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse" 
                              : patient.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              patient.status === "In Consultation" 
                                ? "bg-sky-400" 
                                : patient.status === "Completed"
                                ? "bg-emerald-400"
                                : "bg-slate-400"
                            }`} />
                            {patient.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {[
                  { name: "Dr. K. Perera", specialty: "Cardiology", status: "Active in Room 4", patients: "1 in consult, 3 waiting" },
                  { name: "Dr. R. Alwis", specialty: "General Medicine", status: "Shift starts 15:30", patients: "No active queue" },
                  { name: "Dr. Mrs. Jayasekara", specialty: "Pediatrics", status: "Active in Room 1", patients: "2 waiting" }
                ].map((doc, idx) => (
                  <div key={idx} className="bg-[#090F1B] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{doc.name}</div>
                      <div className="text-xs text-slate-400">{doc.specialty}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-sky-400">{doc.status}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{doc.patients}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Columns - Upload / Medical Record push */}
          <div className="space-y-6">
            
            {/* Quick Upload Record Card */}
            <div className="bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white tracking-tight font-serif italic">Push Record to MedLocker</h3>
              <p className="text-xs text-slate-400 mt-1">Upload prescriptions or OPD summaries directly to patient app locks</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient's Hashed NIC / ID</label>
                  <input
                    type="text"
                    placeholder="Enter patient NIC (e.g. 1994208311V)"
                    className="w-full mt-2 px-4 py-2.5 bg-[#090F1B] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="border border-dashed border-slate-800 hover:border-sky-500/40 rounded-xl p-6 text-center cursor-pointer transition-colors bg-[#090F1B]/50 group">
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">📄</div>
                  <div className="text-xs font-semibold text-slate-300">Drag prescription PDF here</div>
                  <div className="text-[10px] text-slate-500 mt-1">Maximum file size: 5MB</div>
                </div>

                <button 
                  onClick={() => alert("Simulating upload... Record scanned, classified by MedLocker OCR, and synced successfully.")}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 rounded-xl text-xs font-bold text-white shadow-lg shadow-sky-500/10 transition-all"
                >
                  🚀 Upload & Verify with OCR
                </button>
              </div>
            </div>

            {/* Durdans Admin Notices */}
            <div className="bg-[#111A2E]/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">MOH Sri Lanka Bulletins</h3>
              <ul className="mt-4 space-y-3 text-xs">
                <li className="border-l-2 border-amber-500 pl-3">
                  <div className="font-semibold text-slate-300">Influenza Vaccination Season</div>
                  <p className="text-slate-500 mt-0.5">Encourage adult patients with chronic ailments to get their seasonal booster doses.</p>
                </li>
                <li className="border-l-2 border-sky-500 pl-3">
                  <div className="font-semibold text-slate-300">NIC Soft-Matching Integration</div>
                  <p className="text-slate-500 mt-0.5">MedLocker soft matches will bypass SMS codes if patient DOB matches patient profile registration records.</p>
                </li>
              </ul>
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 p-6 text-center text-xs text-slate-500 mt-12 bg-[#0A1220]/20">
        MedLocker Consolidated Hospital System &copy; {new Date().getFullYear()} Healthhub (Pvt) Ltd.
      </footer>
    </div>
  );
}
