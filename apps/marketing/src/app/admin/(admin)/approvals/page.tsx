"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserCheck,
  Search,
  Filter,
  Eye,
  Mail,
  Phone,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Stethoscope,
  FlaskConical,
  Hospital,
  Pill as PillIcon,
  Truck,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  User,
  Info,
} from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { BulkActionBar } from "@/portal/components/admin/BulkActionBar";
import { ExportButton } from "@/portal/components/admin/ExportButton";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

const STATUS_FILTERS = [
  { key: "pending", label: "Pending Review" },
  { key: "active", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

type Item = {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    createdAt: string;
    rejectionReason?: string | null;
  };
  doctorProfile?: {
    specialization?: string | null;
    slmcRegistrationNo?: string | null;
    registrationNumber?: string | null;
    yearsExperience?: number | null;
  } | null;
  labProfile?: {
    userId?: string;
    labName?: string;
    licenseNumber?: string;
    accreditation?: string | null;
    address?: string;
    city?: string | null;
    operatingHours?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    createdAt?: string;
  } | null;
};

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof User;
    tone: "brand" | "success" | "warn" | "info" | "danger" | "neutral" | "accent" | "violet";
    bgLight: string;
    textDark: string;
  }
> = {
  doctor: {
    label: "Doctor",
    icon: Stethoscope,
    tone: "info",
    bgLight: "bg-sky-50",
    textDark: "text-sky-700",
  },
  laboratory: {
    label: "Laboratory",
    icon: FlaskConical,
    tone: "warn",
    bgLight: "bg-amber-50",
    textDark: "text-amber-700",
  },
  hospital_admin: {
    label: "Hospital Admin",
    icon: Hospital,
    tone: "accent",
    bgLight: "bg-purple-50",
    textDark: "text-purple-700",
  },
  pharmacy: {
    label: "Pharmacy",
    icon: PillIcon,
    tone: "violet",
    bgLight: "bg-indigo-50",
    textDark: "text-indigo-700",
  },
  insurance: {
    label: "Insurance",
    icon: ShieldCheck,
    tone: "neutral",
    bgLight: "bg-slate-100",
    textDark: "text-slate-700",
  },
  ambulance: {
    label: "Ambulance",
    icon: Truck,
    tone: "danger",
    bgLight: "bg-rose-50",
    textDark: "text-rose-700",
  },
};

const COMMON_REJECTION_REASONS = [
  "SLMC registration number could not be verified with official registry",
  "Laboratory license number invalid or expired",
  "Missing required council accreditation certificate",
  "Incomplete facility address or invalid contact details",
  "Duplicate registration application",
];

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusKey>("pending");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewTarget, setReviewTarget] = useState<Item | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean>>({});

  // Active status query
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: adminQk.approvals(status),
    queryFn: () => adminApi<{ items: Item[]; total: number }>(`/admin/approvals?status=${status}`),
  });

  // Pending count for top badges
  const { data: pendingData } = useQuery({
    queryKey: adminQk.approvals("pending"),
    queryFn: () => adminApi<{ items: Item[]; total: number }>(`/admin/approvals?status=pending`),
    enabled: status !== "pending",
  });

  const pendingCount = status === "pending" ? data?.items?.length ?? 0 : pendingData?.items?.length ?? 0;

  const approve = useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Account approved successfully");
      setReviewTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error("Could not approve", e.message),
  });

  const reject = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/reject`, { method: "POST", json: { reason } }),
    onSuccess: () => {
      toast.success("Application rejected");
      setRejectTarget(null);
      setReviewTarget(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error("Could not reject", e.message),
  });

  function copyToClipboard(text?: string | null, id: string = "") {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filter items by search query and role filter
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items;

    if (roleFilter !== "all") {
      items = items.filter((it) => it.user.role === roleFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((it) => {
        const u = it.user;
        const doc = it.doctorProfile;
        const lab = it.labProfile;
        return (
          u.name.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q) ||
          (doc?.specialization && doc.specialization.toLowerCase().includes(q)) ||
          (doc?.slmcRegistrationNo && doc.slmcRegistrationNo.toLowerCase().includes(q)) ||
          (lab?.labName && lab.labName.toLowerCase().includes(q)) ||
          (lab?.licenseNumber && lab.licenseNumber.toLowerCase().includes(q)) ||
          (lab?.city && lab.city.toLowerCase().includes(q))
        );
      });
    }

    return items;
  }, [data?.items, roleFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl pb-12">
      {/* ─── Page Header ───────────────────────────────────── */}
      <PageHeader
        title="Account Approvals"
        subtitle="Review, verify credentials, and grant portal access for healthcare practitioners and facilities."
        icon={<UserCheck size={22} className="text-amber-600" />}
        actions={
          <div className="flex items-center gap-2.5">
            <ExportButton exportPath="approvals" filters={{ status }} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={14} className={`mr-1.5 ${isFetching ? "animate-spin text-amber-600" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* ─── Metric Stat Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setStatus("pending");
            setSelected(new Set());
          }}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
            status === "pending"
              ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</span>
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingCount}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
              Needs action
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatus("active");
            setSelected(new Set());
          }}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
            status === "active"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {status === "active" ? data?.items?.length ?? "—" : "Active"}
            </span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Live accounts
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatus("rejected");
            setSelected(new Set());
          }}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
            status === "rejected"
              ? "bg-red-50/80 border-red-300 ring-2 ring-red-500/20 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected</span>
            <XCircle size={16} className="text-red-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {status === "rejected" ? data?.items?.length ?? "—" : "Archive"}
            </span>
            <span className="text-xs font-medium text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full">
              Declined
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatus("suspended");
            setSelected(new Set());
          }}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
            status === "suspended"
              ? "bg-slate-100 border-slate-300 ring-2 ring-slate-400/20 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suspended</span>
            <AlertCircle size={16} className="text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {status === "suspended" ? data?.items?.length ?? "—" : "On Hold"}
            </span>
            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              Restricted
            </span>
          </div>
        </button>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setStatus(f.key);
                  setSelected(new Set());
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none whitespace-nowrap ${
                  active
                    ? "bg-amber-600 text-white shadow-xs font-bold"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                {f.label}
                {f.key === "pending" && pendingCount > 0 ? (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active ? "bg-white/25 text-white" : "bg-amber-200 text-amber-900"
                    }`}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Search Input & Role Filter */}
        <div className="flex items-center gap-2.5 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, phone, license..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            ) : null}
          </div>

          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
              className="h-9 px-3 pr-8 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
            >
              <option value="all">All Roles</option>
              <option value="doctor">Doctors</option>
              <option value="laboratory">Laboratories</option>
              <option value="hospital_admin">Hospitals</option>
              <option value="pharmacy">Pharmacies</option>
              <option value="insurance">Insurance</option>
              <option value="ambulance">Ambulance</option>
            </select>
            <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── Applications Table ──────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin text-amber-600" />
            <p className="text-sm font-medium">Loading applications…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                No {status} applications found
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {searchQuery || roleFilter !== "all"
                  ? "Try adjusting your search terms or filter criteria."
                  : `There are currently no accounts with "${status}" status.`}
              </p>
            </div>
            {(searchQuery || roleFilter !== "all") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                }}
                className="mt-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="bg-slate-50/70 border-b border-slate-200/80">
                  <TH className="w-10 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all applications"
                      checked={
                        filteredItems.length > 0 &&
                        filteredItems.every((it) => selected.has(it.user.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(filteredItems.map((it) => it.user.id)));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                      className="rounded accent-amber-600 cursor-pointer h-4 w-4"
                    />
                  </TH>
                  <TH className="text-xs font-bold uppercase tracking-wider text-slate-600">Applicant</TH>
                  <TH className="text-xs font-bold uppercase tracking-wider text-slate-600">Role &amp; Status</TH>
                  <TH className="text-xs font-bold uppercase tracking-wider text-slate-600">Professional Credentials</TH>
                  <TH className="text-xs font-bold uppercase tracking-wider text-slate-600">Submitted</TH>
                  <TH className="text-right text-xs font-bold uppercase tracking-wider text-slate-600 pr-5">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredItems.map((it) => {
                  const u = it.user;
                  const isChecked = selected.has(u.id);
                  const roleConfig = ROLE_CONFIG[u.role] ?? {
                    label: u.role,
                    icon: User,
                    tone: "neutral" as const,
                    bgLight: "bg-slate-50",
                    textDark: "text-slate-700",
                  };
                  const RoleIcon = roleConfig.icon;

                  return (
                    <TR
                      key={u.id}
                      className={`group hover:bg-amber-50/20 transition-colors border-b border-slate-100 last:border-0 ${
                        isChecked ? "bg-amber-50/35" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <TD className="w-10 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${u.name}`}
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(u.id);
                            else next.delete(u.id);
                            setSelected(next);
                          }}
                          className="rounded accent-amber-600 cursor-pointer h-4 w-4"
                        />
                      </TD>

                      {/* Applicant Info */}
                      <TD>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-xl ${roleConfig.bgLight} ${roleConfig.textDark} flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs border border-slate-200/50`}
                          >
                            <RoleIcon size={18} />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setReviewTarget(it)}
                              className="font-bold text-slate-900 hover:text-amber-700 text-left transition-colors truncate block cursor-pointer"
                            >
                              {u.name}
                            </button>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                              {u.email && (
                                <span className="inline-flex items-center gap-1 truncate" title={u.email}>
                                  <Mail size={12} className="text-slate-400 shrink-0" />
                                  {u.email}
                                </span>
                              )}
                              {u.phone && (
                                <span className="inline-flex items-center gap-1 text-slate-500 shrink-0">
                                  <Phone size={12} className="text-slate-400 shrink-0" />
                                  {u.phone}
                                </span>
                              )}
                            </div>
                            {u.rejectionReason && (
                              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1 font-medium bg-red-50/80 px-2 py-0.5 rounded-md max-w-fit">
                                <AlertCircle size={12} />
                                Rejection Note: {u.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </TD>

                      {/* Role & Status */}
                      <TD>
                        <div className="flex flex-col gap-1.5 items-start">
                          <Pill tone={roleConfig.tone}>
                            <span className="capitalize">{roleConfig.label}</span>
                          </Pill>
                          {u.status === "pending" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending Approval
                            </span>
                          ) : u.status === "active" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                              <CheckCircle2 size={11} /> Approved
                            </span>
                          ) : u.status === "rejected" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/60">
                              <XCircle size={11} /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                              {u.status}
                            </span>
                          )}
                        </div>
                      </TD>

                      {/* Credentials / Details Preview */}
                      <TD>
                        {it.doctorProfile ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Stethoscope size={13} className="text-sky-600" />
                              {it.doctorProfile.specialization || "General Practitioner"}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-[11px] bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200/60 font-semibold">
                                SLMC: {it.doctorProfile.slmcRegistrationNo || "Pending"}
                              </span>
                            </div>
                          </div>
                        ) : it.labProfile ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Building2 size={13} className="text-amber-600" />
                              {it.labProfile.labName || u.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="font-mono text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200/60 font-semibold">
                                LIC: {it.labProfile.licenseNumber}
                              </span>
                              {it.labProfile.city && (
                                <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                                  <MapPin size={11} /> {it.labProfile.city}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Standard registration profile</span>
                        )}
                      </TD>

                      {/* Date Applied */}
                      <TD>
                        <div className="text-xs text-slate-600 flex flex-col gap-0.5">
                          <span className="font-medium text-slate-800 flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            {new Date(u.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(u.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </TD>

                      {/* Action Buttons */}
                      <TD className="text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setReviewTarget(it)}
                            className="text-xs hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye size={13} className="mr-1" />
                            Review
                          </Button>

                          {u.status === "pending" || u.status === "suspended" ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => approve.mutate(u.id)}
                                disabled={approve.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs cursor-pointer"
                              >
                                <CheckCircle2 size={13} className="mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setRejectTarget(it);
                                  setRejectReason("");
                                }}
                                disabled={reject.isPending}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs cursor-pointer"
                              >
                                <XCircle size={13} className="mr-1" />
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {/* ─── Bulk Action Bar ─────────────────────────────────── */}
      <BulkActionBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        invalidateKeys={[adminQk.approvals(status)]}
      />

      {/* ─── Detailed Application Inspection Modal ───────────── */}
      <Modal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget ? `Application: ${reviewTarget.user.name}` : "Application Details"}
        size="lg"
      >
        {reviewTarget && (
          <div className="flex flex-col gap-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Applicant Summary Banner */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
                {reviewTarget.user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">{reviewTarget.user.name}</h3>
                  <Pill tone={ROLE_CONFIG[reviewTarget.user.role]?.tone ?? "neutral"}>
                    {reviewTarget.user.role.replace("_", " ")}
                  </Pill>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      reviewTarget.user.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : reviewTarget.user.status === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {reviewTarget.user.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>Applied on {new Date(reviewTarget.user.createdAt).toLocaleString()}</span>
                  <span className="font-mono text-[10px] text-slate-400">ID: {reviewTarget.user.id}</span>
                </p>
              </div>
            </div>

            {/* Contact & Profile Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Email Address
                </span>
                <p className="text-slate-900 font-medium break-all">
                  {reviewTarget.user.email || "Not provided"}
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Phone Number
                </span>
                <p className="text-slate-900 font-medium">
                  {reviewTarget.user.phone || "Not provided"}
                </p>
              </div>
            </div>

            {/* Role-Specific Credential Details */}
            {reviewTarget.doctorProfile ? (
              <div className="border border-sky-200 bg-sky-50/40 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
                  <Stethoscope size={16} /> Medical Practitioner Credentials
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Specialization:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {reviewTarget.doctorProfile.specialization || "General Medicine"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">SLMC Registration:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm bg-white px-2.5 py-0.5 rounded border border-sky-300 text-sky-900">
                        {reviewTarget.doctorProfile.slmcRegistrationNo || "Pending"}
                      </span>
                      {reviewTarget.doctorProfile.slmcRegistrationNo && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              reviewTarget.doctorProfile!.slmcRegistrationNo!,
                              "slmc"
                            )
                          }
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy SLMC number"
                        >
                          {copiedId === "slmc" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : reviewTarget.labProfile ? (
              <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <FlaskConical size={16} /> Laboratory &amp; Facility Profile
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Facility Name:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {reviewTarget.labProfile.labName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Government / MoH License:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm bg-white px-2.5 py-0.5 rounded border border-amber-300 text-amber-900">
                        {reviewTarget.labProfile.licenseNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(reviewTarget.labProfile!.licenseNumber, "lic")
                        }
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy license number"
                      >
                        {copiedId === "lic" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block text-[11px]">Address &amp; Location:</span>
                    <span className="font-medium text-slate-800">
                      {reviewTarget.labProfile.address}
                      {reviewTarget.labProfile.city ? `, ${reviewTarget.labProfile.city}` : ""}
                    </span>
                  </div>
                  {reviewTarget.labProfile.accreditation && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Accreditation:</span>
                      <span className="font-medium text-slate-800">
                        {reviewTarget.labProfile.accreditation}
                      </span>
                    </div>
                  )}
                  {reviewTarget.labProfile.operatingHours && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Operating Hours:</span>
                      <span className="font-medium text-slate-800">
                        {reviewTarget.labProfile.operatingHours}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-4 flex items-start gap-3">
                <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">
                    Standard Registration Profile
                  </p>
                  <p>
                    No extended institutional profile (SLMC or Laboratory License) has been submitted for this account yet. The applicant completed account registration with their email and phone number.
                  </p>
                </div>
              </div>
            )}

            {/* Verification Checklist */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Verification Checklist (Admin Audit)
              </span>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!verifiedChecks[`${reviewTarget.user.id}-lic`]}
                    onChange={(e) =>
                      setVerifiedChecks((prev) => ({
                        ...prev,
                        [`${reviewTarget.user.id}-lic`]: e.target.checked,
                      }))
                    }
                    className="accent-amber-600 rounded"
                  />
                  <span>Registry or Medical Council license number verified against official records</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!verifiedChecks[`${reviewTarget.user.id}-phone`]}
                    onChange={(e) =>
                      setVerifiedChecks((prev) => ({
                        ...prev,
                        [`${reviewTarget.user.id}-phone`]: e.target.checked,
                      }))
                    }
                    className="accent-amber-600 rounded"
                  />
                  <span>Applicant identity and primary telephone number confirmed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!verifiedChecks[`${reviewTarget.user.id}-org`]}
                    onChange={(e) =>
                      setVerifiedChecks((prev) => ({
                        ...prev,
                        [`${reviewTarget.user.id}-org`]: e.target.checked,
                      }))
                    }
                    className="accent-amber-600 rounded"
                  />
                  <span>Physical premises, clinic, or facility verified in good standing</span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
              <Button variant="ghost" onClick={() => setReviewTarget(null)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                {reviewTarget.user.status === "pending" || reviewTarget.user.status === "suspended" ? (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setRejectTarget(reviewTarget);
                      }}
                    >
                      <XCircle size={15} className="mr-1.5" />
                      Reject Application
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => approve.mutate(reviewTarget.user.id)}
                      loading={approve.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 size={15} className="mr-1.5" />
                      Approve Account
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Rejection Reason Modal ─────────────────────────── */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Reject Application: ${rejectTarget.user.name}` : "Reject Application"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejectTarget) return;
            if (rejectReason.trim().length < 3) {
              toast.error("Reason required", "Please select or type a short explanation.");
              return;
            }
            reject.mutate({
              userId: rejectTarget.user.id,
              reason: rejectReason.trim(),
            });
          }}
        >
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
            <p>
              The rejection reason will be recorded on the user profile and included in their email notification.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Quick Reason Presets:</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REJECTION_REASONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-colors cursor-pointer ${
                    rejectReason === r
                      ? "bg-red-100 text-red-900 border-red-300 font-semibold"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <Field label="Custom Explanation" htmlFor="reject-reason" required>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. SLMC number could not be verified with official medical registry"
              maxLength={500}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={reject.isPending}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}