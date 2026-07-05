"use client";

import React, { useState } from "react";
import Link from "next/link";

interface LabJob {
  id: string;
  patientName: string;
  nic: string;
  testType: string;
  status: "Processing" | "Pending Verification" | "Completed" | "Failed Match";
  confidence: number;
  time: string;
}

export default function LaboratoryPortal() {
  const [jobs, setJobs] = useState<LabJob[]>([
    { id: "J801", patientName: "Ahamed Thufail", nic: "1994198300V", testType: "Lipid Panel", status: "Completed", confidence: 98, time: "15:20" },
    { id: "J802", patientName: "Dilanka Senavirathne", nic: "1990283944V", testType: "Full Blood Count (FBC)", status: "Pending Verification", confidence: 87, time: "15:35" },
    { id: "J803", patientName: "Nisha Mohamed", nic: "1983582910V", testType: "TSH / Thyroid Profile", status: "Processing", confidence: 92, time: "15:45" },
    { id: "J804", patientName: "J. K. Wijetunga", nic: "1972109282V", testType: "Renal Function Test", status: "Failed Match", confidence: 42, time: "15:50" }
  ]);

  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "completed">("all");
  const [dragActive, setDragActive] = useState(false);

  const filteredJobs = jobs.filter(j => {
    if (activeFilter === "pending") return j.status === "Processing" || j.status === "Pending Verification";
    if (activeFilter === "completed") return j.status === "Completed";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#060B14] text-white flex flex-col font-sans relative">
      {/* Background radial highlights */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-slate-900 bg-[#090F1B]/95 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">MedLocker</span>
          </Link>
          <span className="h-4 w-px bg-slate-800" />
          <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/15">
            🔬 ASIRI LABS WORKER
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white">Harsha Perera</div>
            <div className="text-xs text-slate-400">Chief Lab Technologist</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#0F1C2E] border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400">
            HP
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
          <div className="bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-5 hover:border-slate-850 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reports Ingested Today</div>
            <div className="mt-2 text-3xl font-extrabold text-white">
              114 <span className="text-xs font-medium text-emerald-400">+12% vs yest.</span>
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Includes direct PDF forwards</div>
          </div>
          <div className="bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-5 hover:border-slate-850 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Link Rate</div>
            <div className="mt-2 text-3xl font-extrabold text-emerald-400">
              89.4%
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Matched via registered NIC</div>
          </div>
          <div className="bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-5 hover:border-slate-850 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending OCR Verifications</div>
            <div className="mt-2 text-3xl font-extrabold text-sky-400">
              5
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Require human-in-the-loop audit</div>
          </div>
          <div className="bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-5 hover:border-slate-850 transition-all">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">D1 Lock Success Rate</div>
            <div className="mt-2 text-3xl font-extrabold text-sky-400">
              100%
            </div>
            <div className="mt-1.5 text-xs text-slate-500">Zero database connection losses</div>
          </div>
        </div>

        {/* Lab Processing Grid split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Columns - Recently Processed */}
          <div className="lg:col-span-2 bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-6 flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight font-serif italic">Recent Lab Ingestions</h3>
                <p className="text-xs text-slate-400 mt-1">Processed PDF reports and metadata classifications</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeFilter === "all" 
                      ? "bg-emerald-500 text-white" 
                      : "bg-[#090F1B] text-slate-400 hover:text-white"
                  }`}
                >
                  All Jobs
                </button>
                <button 
                  onClick={() => setActiveFilter("pending")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeFilter === "pending" 
                      ? "bg-emerald-500 text-white" 
                      : "bg-[#090F1B] text-slate-400 hover:text-white"
                  }`}
                >
                  Pending
                </button>
                <button 
                  onClick={() => setActiveFilter("completed")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeFilter === "completed" 
                      ? "bg-emerald-500 text-white" 
                      : "bg-[#090F1B] text-slate-400 hover:text-white"
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Job ID & Patient Name</th>
                    <th className="pb-3 font-semibold">Test Details</th>
                    <th className="pb-3 font-semibold">NIC Lock</th>
                    <th className="pb-3 font-semibold">OCR Confidence</th>
                    <th className="pb-3 font-semibold text-right">Job Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="group hover:bg-[#16223F]/20 transition-all">
                      <td className="py-4">
                        <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{job.patientName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Job #{job.id} · Received {job.time}</div>
                      </td>
                      <td className="py-4 text-slate-300">{job.testType}</td>
                      <td className="py-4 font-mono text-xs text-slate-400">{job.nic}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 w-16 bg-[#090F1B] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                job.confidence >= 95 
                                  ? "bg-emerald-500" 
                                  : job.confidence >= 80 
                                  ? "bg-sky-500" 
                                  : "bg-amber-500"
                              }`} 
                              style={{ width: `${job.confidence}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold">{job.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          job.status === "Completed" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : job.status === "Processing" 
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse" 
                            : job.status === "Pending Verification"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            job.status === "Completed" 
                              ? "bg-emerald-400" 
                              : job.status === "Processing" 
                              ? "bg-sky-400" 
                              : job.status === "Pending Verification"
                              ? "bg-amber-400"
                              : "bg-red-400"
                          }`} />
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Columns - Upload & Config */}
          <div className="space-y-6">

            {/* Ingestion & PDF Upload */}
            <div className="bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white tracking-tight font-serif italic">Scan & Link Lab Report</h3>
              <p className="text-xs text-slate-400 mt-1">Upload lab PDFs to trigger the OCR AI routing pipeline</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient NIC</label>
                  <input
                    type="text"
                    placeholder="e.g. 1994198300V"
                    className="w-full mt-2 px-4 py-2.5 bg-[#090F1B] border border-slate-900 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="border border-dashed border-slate-850 hover:border-emerald-500/40 rounded-xl p-6 text-center cursor-pointer transition-colors bg-[#090F1B]/50 group">
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🧬</div>
                  <div className="text-xs font-semibold text-slate-300">Drag Lab Report PDF here</div>
                  <div className="text-[10px] text-slate-500 mt-1">PDF or image format, up to 10MB</div>
                </div>

                <button 
                  onClick={() => alert("PDF report loaded. Llama 3.2 Vision classification: confidence 98%, extracted 18 vitals markers, linked directly to NIC: 1994198300V locker successfully.")}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white shadow-lg shadow-emerald-500/10 transition-all"
                >
                  ⚡ Scan, Classify & Auto-Link
                </button>
              </div>
            </div>

            {/* Lab tech guidelines */}
            <div className="bg-[#0F172A]/80 border border-slate-900 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Technician Guidelines</h3>
              <ul className="mt-4 space-y-3 text-xs text-slate-400">
                <li className="flex gap-2">
                  <span>✔</span>
                  <span><strong>D1 Auto-Sync:</strong> Any report uploaded automatically matches and encrypts in the patient's family vault within 1 second.</span>
                </li>
                <li className="flex gap-2">
                  <span>✔</span>
                  <span><strong>High Accuracy:</strong> For confidence scores below 70%, please audit names and birthdates manually before committing the record.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 p-6 text-center text-xs text-slate-500 mt-12 bg-[#090F1B]/20">
        MedLocker Consolidated Laboratory System &copy; {new Date().getFullYear()} Healthhub (Pvt) Ltd.
      </footer>
    </div>
  );
}
