"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { ArrowLeft, Building2, Upload } from "lucide-react";

// Simple & Robust CSV / Delimited Spreadsheet Parser for Vendors
function parseVendorCSV(text: string) {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseRow = (rowStr: string) => {
    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = "";
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if ((char === "," || char === "\t" || char === ";") && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    return row;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const dataRows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCells = parseRow(lines[i]);
    if (rawCells.every((c) => !c)) continue;

    const rowObj: any = { rowNumber: i + 1 };
    headers.forEach((h, colIdx) => {
      const val = rawCells[colIdx] || "";
      if (h === "vendorname" || h === "name" || h === "supplier" || h === "company" || h.includes("vendorname")) {
        rowObj.name = val;
      } else if (h === "code" || h === "vendorcode" || h === "suppliercode") {
        rowObj.code = val;
      } else if (h.includes("contact") || h.includes("person") || h.includes("representative")) {
        rowObj.contactPerson = val;
      } else if (h.includes("email") || h.includes("mail")) {
        rowObj.email = val;
      } else if (h.includes("phone") || h.includes("mobile") || h.includes("tel")) {
        rowObj.phone = val;
      } else if (h.includes("address") || h.includes("location") || h.includes("street")) {
        rowObj.address = val;
      } else if (h.includes("tax") || h.includes("gst") || h.includes("vat")) {
        rowObj.taxId = val;
      } else if (h.includes("term") || h.includes("payment")) {
        rowObj.paymentTerms = val.toUpperCase().replace(/\s+/g, "");
      } else if (h === "status" || h.includes("state")) {
        rowObj.status = val.toUpperCase();
      } else if (h.includes("note") || h.includes("remark") || h.includes("detail") || h.includes("desc")) {
        rowObj.notes = val;
      }
    });

    if (rowObj.name) {
      dataRows.push(rowObj);
    }
  }

  return dataRows;
}

interface Outlet {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  outletIds?: string[];
  notes?: string;
  createdAt: string;
}

export default function VendorDirectoryPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // BULK IMPORT VIA EXCEL / CSV STATES
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkFullScreen, setIsBulkFullScreen] = useState(true);
  const [previewFile, setPreviewFile] = useState<{ name: string; size: number } | null>(null);
  const [parsedVendorRows, setParsedVendorRows] = useState<any[]>([]);
  const [previewFilterTab, setPreviewFilterTab] = useState<"all" | "update" | "new" | "identical">("all");
  const [expandedDiffRowIdx, setExpandedDiffRowIdx] = useState<number | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [vendorImportReport, setVendorImportReport] = useState<{
    added: Array<{ row: number; name: string; code?: string }>;
    updated: Array<{
      row: number;
      name: string;
      code?: string;
      overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
    }>;
    skipped: Array<{ row: number; name: string; code?: string; reason: string }>;
    failed: Array<{ row: number; name: string; reason: string }>;
  } | null>(null);
  const [vendorReportTab, setVendorReportTab] = useState<"updated" | "added" | "skipped" | "failed">("updated");

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const [form, setForm] = useState({
    name: "",
    code: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    paymentTerms: "NET30",
    status: "ACTIVE",
    outletIds: [] as string[],
    notes: "",
  });

  const fetchOutlets = async () => {
    try {
      const res = await fetch("/api/restaurant/outlets");
      const data = await res.json();
      if (res.ok) setOutlets(data.outlets || []);
    } catch {
      // ignore
    }
  };

  const fetchVendors = async (s = search, st = statusFilter, out = outletFilter) => {
    try {
      const p = new URLSearchParams();
      if (s) p.set("search", s);
      if (st) p.set("status", st);
      if (out) p.set("outletId", out);
      const res = await fetch(`/api/restaurant/inventory/vendors?${p}`);
      const data = await res.json();
      if (res.ok) setVendors(data.vendors || []);
    } catch {
      setError("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
    fetchVendors();
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchVendors(val, statusFilter, outletFilter);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchVendors(search, val, outletFilter);
  };

  const handleOutletFilter = (val: string) => {
    setOutletFilter(val);
    fetchVendors(search, statusFilter, val);
  };

  const toggleOutletSelection = (outletId: string) => {
    setForm((prev) => {
      const exists = prev.outletIds.includes(outletId);
      if (exists) {
        return { ...prev, outletIds: prev.outletIds.filter((id) => id !== outletId) };
      } else {
        return { ...prev, outletIds: [...prev.outletIds, outletId] };
      }
    });
  };

  const handleSelectAllOutlets = (selectAll: boolean) => {
    if (selectAll) {
      setForm((prev) => ({ ...prev, outletIds: outlets.map((o) => o.id) }));
    } else {
      setForm((prev) => ({ ...prev, outletIds: [] }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Vendor name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCreate(false);
      setForm({
        name: "",
        code: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        taxId: "",
        paymentTerms: "NET30",
        status: "ACTIVE",
        outletIds: [],
        notes: "",
      });
      fetchVendors();
      flashSuccess(`Supplier "${form.name}" registered successfully`);
    } catch (e: any) {
      setError(e.message || "Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Vendor Template Download
  const handleDownloadVendorTemplate = () => {
    const csvContent =
      "Vendor Name,Vendor Code,Contact Person,Email,Phone,Address,Tax ID / GST,Payment Terms,Status,Notes\r\n" +
      "Fresh Produce Direct,VEND-001,John Doe,orders@freshproduce.com,+1 555-0192,123 Market St,GSTIN12345ABC,NET30,ACTIVE,Daily morning produce delivery\r\n" +
      "Apex Packaging Co,VEND-002,Jane Smith,sales@apexpack.com,+1 555-0144,456 Industrial Pkwy,GSTIN98765XYZ,NET15,ACTIVE,Supplies takeout boxes and napkins\r\n" +
      "Valley Dairy Farms,VEND-003,Bob Miller,support@valleydairy.com,+1 555-0188,789 Farm Rd,GSTIN54321DEF,COD,ACTIVE,Weekly dairy and cheese deliveries\r\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_vendors_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Vendor File Select & Local Parsing with Multi-Field Diffing
  const handleVendorFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setVendorImportReport(null);
    setExpandedDiffRowIdx(null);
    setPreviewFilterTab("all");

    try {
      const text = await file.text();
      const rawRows = parseVendorCSV(text);
      if (rawRows.length === 0) {
        throw new Error("The uploaded file contains no readable vendor rows.");
      }

      // Fetch fresh list of all vendors to ensure accurate matching and diffing
      let catalog = vendors;
      try {
        const vRes = await fetch("/api/restaurant/inventory/vendors");
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.vendors) catalog = vData.vendors;
        }
      } catch {
        // Fallback to current vendors state
      }

      // Compute diff across all 10 fields for every row
      const processedRows = rawRows.map((row: any, idx: number) => {
        const rowCode = (row.code || "").trim();
        const rowName = (row.name || "").trim();
        const codeLower = rowCode.toLowerCase();
        const nameLower = rowName.toLowerCase();

        // Match existing vendor: by code first, then by name
        let matched: Vendor | undefined = undefined;
        if (codeLower) {
          matched = catalog.find((v) => (v.code || "").trim().toLowerCase() === codeLower);
        }
        if (!matched && nameLower) {
          matched = catalog.find((v) => (v.name || "").trim().toLowerCase() === nameLower);
        }

        const overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];

        if (matched) {
          const checkField = (field: string, label: string, current: string | undefined, incoming: string | undefined) => {
            const c = (current || "").trim();
            const n = (incoming || "").trim();
            if (n && n !== c) {
              overrides.push({
                field,
                label,
                oldValue: c || "—",
                newValue: n,
              });
            }
          };

          checkField("name", "Supplier Name", matched.name, row.name);
          checkField("code", "Vendor Code", matched.code, row.code);
          checkField("contactPerson", "Representative", matched.contactPerson, row.contactPerson);
          checkField("email", "Email Address", matched.email, row.email);
          checkField("phone", "Phone Number", matched.phone, row.phone);
          checkField("address", "Address", matched.address, row.address);
          checkField("taxId", "Tax ID / GST", matched.taxId, row.taxId);
          checkField("paymentTerms", "Payment Terms", matched.paymentTerms, row.paymentTerms);
          checkField("status", "Status", matched.status, row.status);
          checkField("notes", "Notes", matched.notes, row.notes);

          const isUpdate = overrides.length > 0;
          return {
            ...row,
            rowNumber: row.rowNumber || idx + 1,
            matchType: isUpdate ? "UPDATE" : "IDENTICAL",
            matchedVendorId: matched.id,
            matchedVendorName: matched.name,
            overrides,
            selected: isUpdate, // Default checked if there are overrides to apply!
          };
        } else {
          return {
            ...row,
            rowNumber: row.rowNumber || idx + 1,
            matchType: "NEW",
            matchedVendorId: undefined,
            matchedVendorName: undefined,
            overrides: [],
            selected: true, // Default checked for new suppliers
          };
        }
      });

      setParsedVendorRows(processedRows);
      setPreviewFile({ name: file.name, size: file.size });
    } catch (err: any) {
      setError(err.message || "Failed to parse vendor spreadsheet.");
    } finally {
      e.target.value = "";
    }
  };

  // Row selection helpers
  const toggleSelectRow = (rowNumber: number) => {
    setParsedVendorRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, selected: !r.selected } : r))
    );
  };

  const setAllSelection = (selected: boolean, filterType?: "UPDATE" | "NEW") => {
    setParsedVendorRows((prev) =>
      prev.map((r) => {
        if (filterType && r.matchType !== filterType) return r;
        return { ...r, selected };
      })
    );
  };

  // Confirm Vendor Bulk Import
  const handleConfirmVendorImport = async () => {
    const selectedRows = parsedVendorRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setError("Please select at least one supplier row to import or update.");
      return;
    }

    setBulkImporting(true);
    setError("");

    try {
      const payload = {
        vendors: selectedRows.map((r) => ({
          rowNumber: r.rowNumber,
          name: r.name,
          code: r.code,
          contactPerson: r.contactPerson,
          email: r.email,
          phone: r.phone,
          address: r.address,
          taxId: r.taxId,
          paymentTerms: r.paymentTerms,
          status: r.status,
          notes: r.notes,
          action: r.matchType === "UPDATE" ? "UPDATE" : "CREATE",
          existingVendorId: r.matchedVendorId,
        })),
        updateExisting: true,
      };

      const res = await fetch("/api/restaurant/inventory/vendors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process bulk import");

      setVendorImportReport(data.report);
      setPreviewFile(null);
      if (data.report.updated && data.report.updated.length > 0) {
        setVendorReportTab("updated");
      } else if (data.report.added && data.report.added.length > 0) {
        setVendorReportTab("added");
      } else if (data.report.failed && data.report.failed.length > 0) {
        setVendorReportTab("failed");
      } else {
        setVendorReportTab("skipped");
      }
      const addedCount = data.report.added?.length || 0;
      const updatedCount = data.report.updated?.length || 0;
      flashSuccess(`Import complete! Registered ${addedCount} new, updated ${updatedCount} existing suppliers.`);
      await fetchVendors();
    } catch (err: any) {
      setError(err.message || "Failed to import vendors.");
    } finally {
      setBulkImporting(false);
    }
  };

  const getOutletNames = (outletIds?: string[]) => {
    if (!outletIds || outletIds.length === 0) {
      return "All Locations";
    }
    const names = outletIds
      .map((id) => outlets.find((o) => o.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "All Locations";
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Vendor Directory...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="vendor_management" moduleName="Vendor Management" activeSection="Vendors">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Vendors" />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Executive Header Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 ${
              isDark
                ? "bg-gradient-to-br from-[#121829] via-[#0E1320] to-[#0A0D14] border-white/[0.08] shadow-xl shadow-black/20"
                : "bg-gradient-to-br from-blue-50/80 via-indigo-50/25 to-white border-blue-100/80 shadow-sm shadow-blue-500/5"
            }`}
          >
            {/* Ambient Glow Orbs */}
            <div className="absolute -right-16 -top-16 w-72 h-72 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-1/3 -bottom-16 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Left: Nav & Title */}
            <div className="relative z-10 space-y-2 sm:space-y-2.5 w-full md:w-auto min-w-0">
              <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/inventory`)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                    isDark
                      ? "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                  }`}
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Inventory</span>
                </button>
                <span className="hidden sm:inline text-slate-300 dark:text-white/20">•</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                  <span>Procurement Partners</span>
                </span>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0 border border-white/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className={`text-base sm:text-xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                    Supplier &amp; Vendor Directory
                  </h1>
                  <p className={`text-[10px] sm:text-xs mt-0.5 truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Manage commercial distributors, multi-location coverage, payment terms, and price contracts.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Actions & Status Capsule */}
            <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
              <div className={`hidden lg:flex p-2.5 px-3 rounded-xl border items-center gap-2.5 ${
                isDark
                  ? "bg-[#141A29]/80 border-white/[0.08] shadow-sm"
                  : "bg-white/90 backdrop-blur-xs border-slate-200/80 shadow-xs"
              }`}>
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Directory Active
                    </span>
                  </div>
                  <span className={`text-[10px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {vendors.length} Registered Suppliers
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(true);
                  setPreviewFile(null);
                  setVendorImportReport(null);
                  setParsedVendorRows([]);
                }}
                className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-200"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Import via Excel</span>
              </button>

              <button
                onClick={() => setShowCreate(true)}
                className="px-3.5 py-1.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                + Add Vendor
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-2xl flex items-center justify-between animate-in fade-in">
              <span className="font-medium">{successMsg}</span>
              <button onClick={() => setSuccessMsg("")} className="opacity-60 hover:opacity-100 text-xs font-bold cursor-pointer">×</button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
              {error}
            </div>
          )}

          {/* Filter Controls: Search + Status + Location Filter */}
          <div className="flex gap-3 flex-wrap items-center">
            <input
              placeholder="Search suppliers by name, code, contact or email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className={`flex-1 min-w-56 px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            />

            {/* Location / Branch Filter */}
            {outlets.length > 0 && (
              <select
                value={outletFilter}
                onChange={(e) => handleOutletFilter(e.target.value)}
                className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Locations (Consolidated)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    Location: {o.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>

          {/* Vendors Display: Cards on Mobile, Table on Desktop */}
          {vendors.length === 0 ? (
            <div
              className={`p-12 rounded-3xl border text-center space-y-3 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#0071E3] mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold">No suppliers found</h3>
              <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {outletFilter
                  ? "No suppliers registered for this specific location. Click \"+ Add Vendor\" to configure suppliers."
                  : "Click \"+ Add Vendor\" to configure your procurement partners and location mappings."}
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (block md:hidden) */}
              <div className="block md:hidden space-y-3">
                {vendors.map((v) => {
                  const locationText = getOutletNames(v.outletIds);
                  const isAllLocations = !v.outletIds || v.outletIds.length === 0;

                  return (
                    <div
                      key={v.id}
                      onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors/${v.id}`)}
                      className={`p-4 rounded-2xl border shadow-2xs space-y-3.5 transition cursor-pointer active:scale-[0.99] ${
                        isDark ? "bg-[#121622] border-white/[0.08] hover:border-[#0071E3]/40" : "bg-white border-slate-200 hover:border-[#0071E3]/40"
                      }`}
                    >
                      {/* Card Top: Name, Code, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {v.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {v.code && (
                              <span className="font-mono text-[10px] opacity-60">
                                CODE: {v.code}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                isAllLocations
                                  ? isDark ? "bg-blue-500/15 text-blue-300 border-blue-500/25" : "bg-blue-50 text-blue-700 border-blue-200"
                                  : isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/25" : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              📍 {locationText}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                            v.status === "ACTIVE"
                              ? isDark
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : v.status === "BLOCKED"
                              ? isDark
                                ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                              : isDark
                              ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>

                      {/* Card Info Grid */}
                      <div
                        className={`grid grid-cols-2 gap-2 p-2.5 rounded-xl border text-xs ${
                          isDark ? "bg-[#090B10]/60 border-white/[0.04]" : "bg-slate-50/80 border-slate-100"
                        }`}
                      >
                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase">Contact</div>
                          <div className="font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                            {v.contactPerson || "Direct Line"}
                          </div>
                          {v.phone && (
                            <div className={`text-[11px] font-mono font-medium ${isDark ? "text-[#25D366]" : "text-emerald-700"}`}>
                              {v.phone}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase">Terms &amp; Tax</div>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                            {v.paymentTerms}
                          </div>
                          <div className="text-[10px] opacity-60 font-mono truncate">
                            {v.taxId || "No Tax ID"}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Link */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] opacity-60 truncate">
                          {v.email || "No email registered"}
                        </span>
                        <span className="text-[#0071E3] font-semibold flex items-center gap-1 shrink-0">
                          <span>View Catalog</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (hidden md:block) */}
              <div
                className={`hidden md:block rounded-3xl border overflow-hidden shadow-sm ${
                  isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                        isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-500 bg-slate-50/50"
                      }`}>
                        <th className="py-3.5 px-4">Vendor / Company</th>
                        <th className="py-3.5 px-4">Serviced Locations</th>
                        <th className="py-3.5 px-4">Representative Contact</th>
                        <th className="py-3.5 px-4">Payment Terms</th>
                        <th className="py-3.5 px-4">Tax Identifier</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-xs">
                      {vendors.map((v) => {
                        const locationText = getOutletNames(v.outletIds);
                        const isAllLocations = !v.outletIds || v.outletIds.length === 0;

                        return (
                          <tr
                            key={v.id}
                            onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors/${v.id}`)}
                            className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer group"
                          >
                            <td className="py-3.5 px-4">
                              <span className={`font-semibold block ${isDark ? "text-white" : "text-slate-900"}`}>
                                {v.name}
                              </span>
                              {v.code && (
                                <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                  CODE: {v.code}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                                  isAllLocations
                                    ? isDark ? "bg-blue-500/15 text-blue-300 border-blue-500/25" : "bg-blue-50 text-blue-700 border-blue-200"
                                    : isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/25" : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                <span>📍</span>
                                <span>{locationText}</span>
                              </span>
                            </td>

                            <td className={`py-3.5 px-4 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                              <span className="block font-medium">{v.contactPerson || "Primary Contact"}</span>
                              {v.phone && <span className={`text-[10px] font-mono block ${isDark ? "text-[#25D366]" : "text-emerald-700 font-semibold"}`}>{v.phone}</span>}
                              {v.email && <span className={`text-[10px] block opacity-75 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>{v.email}</span>}
                            </td>
                            <td className={`py-3.5 px-4 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                              {v.paymentTerms}
                            </td>
                            <td className={`py-3.5 px-4 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                              {v.taxId || "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                                v.status === "ACTIVE"
                                  ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : v.status === "BLOCKED"
                                  ? isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
                                  : isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                {v.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="text-[#0071E3] font-semibold group-hover:underline text-xs">
                                Catalog →
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Add Vendor Modal (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 max-h-[88vh] md:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Register Supplier Profile</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Add commercial credentials, location coverage, and payment terms.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Vendor Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sysco Foods Inc."
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Vendor Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. VEN-SYS"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                {/* Multi-Location Selection */}
                {outlets.length > 0 && (
                  <div className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    isDark ? "bg-[#090B10]/60 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className={`block text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          Serviced Restaurant Locations
                        </label>
                        <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          Select which branches or outlets this vendor delivers to.
                        </p>
                      </div>

                      {/* Clean Select All / Clear All Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, outletIds: outlets.map((o) => o.id) }))}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                            form.outletIds.length === outlets.length
                              ? "bg-[#0071E3] text-white border-[#0071E3]"
                              : isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, outletIds: [] }))}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                            form.outletIds.length === 0
                              ? isDark
                                ? "bg-white/[0.08] text-white border-white/[0.15]"
                                : "bg-slate-200 text-slate-800 border-slate-300"
                              : isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {outlets.map((o) => {
                        const isSelected = form.outletIds.includes(o.id);

                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => toggleOutletSelection(o.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? isDark
                                  ? "bg-[#0071E3] border-[#0071E3] text-white shadow-xs"
                                  : "bg-[#0071E3] border-[#0071E3] text-white shadow-xs"
                                : isDark
                                ? "bg-[#0A0C12] border-white/[0.08] text-[#8F95A3] hover:text-white hover:border-white/[0.15]"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{o.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {form.outletIds.length === 0
                        ? "No locations selected. Click locations to assign."
                        : form.outletIds.length === outlets.length
                        ? "✨ Supplying to all restaurant locations."
                        : `Delivering to ${form.outletIds.length} of ${outlets.length} selected location(s).`}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Representative Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={form.contactPerson}
                      onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="orders@vendor.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                {/* Single Row for Phone / Mobile */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Phone / Mobile Number (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 000-0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Payment Terms
                    </label>
                    <select
                      value={form.paymentTerms}
                      onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="PREPAID">Prepaid</option>
                      <option value="COD">Cash On Delivery</option>
                      <option value="NET7">Net 7 Days</option>
                      <option value="NET15">Net 15 Days</option>
                      <option value="NET30">Net 30 Days</option>
                      <option value="NET60">Net 60 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Tax ID / GST
                    </label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={form.taxId}
                      onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Register Vendor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BULK IMPORT VENDORS VIA EXCEL / CSV MODAL (Full Screen / Adaptive Modal) */}
        {showBulkModal && (
          <div className={`fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-150 ${
            isBulkFullScreen || previewFile || vendorImportReport ? "p-0 md:p-3 lg:p-4" : "p-0 md:p-4 items-end md:items-center"
          }`}>
            <div
              className={`w-full flex flex-col shadow-2xl animate-in duration-200 ${
                isBulkFullScreen || previewFile || vendorImportReport
                  ? "h-full md:h-[96vh] md:max-w-[98vw] rounded-none md:rounded-3xl border md:border p-4 sm:p-6 lg:p-7 overflow-hidden"
                  : "max-w-2xl p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border max-h-[88vh] md:max-h-[90vh] overflow-y-auto space-y-6"
              } ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center shrink-0 mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                      {previewFile
                        ? "Preview Suppliers to Import"
                        : vendorImportReport
                        ? "Supplier Import Summary"
                        : "Bulk Import Suppliers via Spreadsheet"}
                    </h2>
                    {previewFile && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] dark:text-[#58A6FF] border border-[#0071E3]/20">
                        {parsedVendorRows.length} {parsedVendorRows.length === 1 ? "Supplier" : "Suppliers"} Detected
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {previewFile
                      ? `Review parsed suppliers from ${previewFile.name} before confirming import.`
                      : vendorImportReport
                      ? "Summary of added, skipped, and failed vendor records."
                      : "Upload your vendor directory via Excel spreadsheet or CSV file."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Fullscreen Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsBulkFullScreen((prev) => !prev)}
                    title={isBulkFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] text-slate-300 hover:text-white"
                        : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {isBulkFullScreen ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 0l-5-5" />
                      </svg>
                    )}
                  </button>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkModal(false);
                      setPreviewFile(null);
                      setParsedVendorRows([]);
                    }}
                    title="Close"
                    className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] text-slate-400 hover:text-white"
                        : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* STEP 1: FILE UPLOAD DROP BOX */}
              {!previewFile && !vendorImportReport && (
                <div className={`flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-5 ${isBulkFullScreen ? "py-8" : ""}`}>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition flex flex-col items-center justify-center space-y-4 relative cursor-pointer ${
                      isDark
                        ? "border-white/10 hover:border-[#0071E3]/50 bg-[#090B10]/50"
                        : "border-slate-300 hover:border-[#0071E3] bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleVendorFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Click or drag &amp; drop vendor spreadsheet to upload</p>
                      <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Supports .CSV, .XLSX, .XLS files (Names, codes, contacts, tax IDs &amp; payment terms)
                      </p>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                      isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-blue-50/50 border-blue-100"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">Need the standard supplier import format?</p>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Includes sample rows with contact details, payment terms, and tax IDs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadVendorTemplate}
                      className="px-3.5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download Template</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PREVIEW DATA TABLE, OVERRIDES & CONFIRMATION */}
              {previewFile && !vendorImportReport && (() => {
                const totalRows = parsedVendorRows.length;
                const updateRows = parsedVendorRows.filter((r) => r.matchType === "UPDATE");
                const newRows = parsedVendorRows.filter((r) => r.matchType === "NEW");
                const identicalRows = parsedVendorRows.filter((r) => r.matchType === "IDENTICAL");

                const filteredRows = parsedVendorRows.filter((r) => {
                  if (previewFilterTab === "update") return r.matchType === "UPDATE";
                  if (previewFilterTab === "new") return r.matchType === "NEW";
                  if (previewFilterTab === "identical") return r.matchType === "IDENTICAL";
                  return true;
                });

                const selectedCount = parsedVendorRows.filter((r) => r.selected).length;
                const selectedUpdates = updateRows.filter((r) => r.selected).length;
                const selectedNew = newRows.filter((r) => r.selected).length;
                const isAllFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => r.selected);

                return (
                  <div className="flex-1 min-h-0 flex flex-col space-y-3 sm:space-y-4">
                    {/* File Info & Intelligence Summary Banner */}
                    <div className={`p-3 sm:p-4 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 shrink-0 ${isDark ? "bg-[#090B10] border-white/[0.08]" : "bg-blue-50/60 border-blue-100"}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] shrink-0">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white">{previewFile.name}</h3>
                            <span className="text-[11px] font-mono opacity-50 shrink-0">({(previewFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <p className={`text-[11px] sm:text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            Analyzed <span className="font-semibold text-slate-900 dark:text-white">{totalRows} suppliers</span>: detected{" "}
                            <span className="font-bold text-amber-500">{updateRows.length} with field updates</span>,{" "}
                            <span className="font-bold text-emerald-500">{newRows.length} new records</span>, and{" "}
                            <span className="opacity-60">{identicalRows.length} already up-to-date</span>.
                          </p>
                        </div>
                      </div>

                      {/* Quick Select & Filter Buttons */}
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                        {updateRows.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllSelection(true, "UPDATE")}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                          >
                            ✓ Select All Overrides ({updateRows.length})
                          </button>
                        )}
                        {newRows.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllSelection(true, "NEW")}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                          >
                            + Select All New ({newRows.length})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewFile(null);
                            setParsedVendorRows([]);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                            isDark ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          Re-select File
                        </button>
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1">
                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                          previewFilterTab === "all"
                            ? "bg-[#0071E3] text-white shadow-xs"
                            : isDark ? "bg-white/[0.04] text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All Suppliers ({totalRows})
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("update")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          previewFilterTab === "update"
                            ? "bg-amber-500 text-white shadow-xs"
                            : isDark ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        <span>⚡ Overrides / Updates</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                          {updateRows.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("new")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          previewFilterTab === "new"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : isDark ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        <span>+ New Suppliers</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                          {newRows.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("identical")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          previewFilterTab === "identical"
                            ? "bg-slate-600 text-white shadow-xs"
                            : isDark ? "bg-white/[0.04] text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <span>✓ Identical (No changes)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                          {identicalRows.length}
                        </span>
                      </button>
                    </div>

                    {/* PREVIEW TABLE WITH BIDIRECTIONAL SCROLL */}
                    <div className={`flex-1 min-h-0 rounded-2xl border overflow-x-auto overflow-y-auto text-xs ${isDark ? "bg-[#090B10] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                      <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1050px]">
                        <thead className="sticky top-0 z-20">
                          <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "bg-[#161B29] border-white/[0.08] text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
                            <th className="py-3 px-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={isAllFilteredSelected}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  const rowNums = new Set(filteredRows.map((r) => r.rowNumber));
                                  setParsedVendorRows((prev) =>
                                    prev.map((r) => (rowNums.has(r.rowNumber) ? { ...r, selected: val } : r))
                                  );
                                }}
                                className="rounded cursor-pointer accent-[#0071E3]"
                                title="Toggle All Visible"
                              />
                            </th>
                            <th className="py-3 px-3 w-12 text-center">#</th>
                            <th className="py-3 px-4 min-w-[160px]">Action / Status</th>
                            <th className="py-3 px-4 min-w-[200px]">Supplier Name</th>
                            <th className="py-3 px-4 min-w-[130px]">Vendor Code</th>
                            <th className="py-3 px-4 min-w-[160px]">Contact Person</th>
                            <th className="py-3 px-4 min-w-[180px]">Email &amp; Phone</th>
                            <th className="py-3 px-4 min-w-[130px]">Payment Terms</th>
                            <th className="py-3 px-4 min-w-[120px]">Tax ID / GST</th>
                            <th className="py-3 px-4 min-w-[100px]">Status</th>
                            <th className="py-3 px-4 min-w-[200px]">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                          {filteredRows.map((row) => {
                            const isExpanded = expandedDiffRowIdx === row.rowNumber;
                            const overridesMap = new Map<string, any>((row.overrides || []).map((o: any) => [o.field, o]));

                            return (
                              <React.Fragment key={row.rowNumber}>
                                <tr className={`transition-colors ${
                                  row.selected
                                    ? isDark ? "bg-white/[0.02]" : "bg-blue-50/20"
                                    : "opacity-60"
                                } ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"}`}>
                                  {/* Checkbox */}
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={row.selected}
                                      onChange={() => toggleSelectRow(row.rowNumber)}
                                      className="rounded cursor-pointer accent-[#0071E3]"
                                    />
                                  </td>

                                  {/* Row # */}
                                  <td className="py-2.5 px-3 font-mono opacity-50 text-[11px] text-center">{row.rowNumber}</td>

                                  {/* Action / Match badge */}
                                  <td className="py-2.5 px-4">
                                    {row.matchType === "UPDATE" && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedDiffRowIdx(isExpanded ? null : row.rowNumber)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1.5"
                                      >
                                        <span>⚡ Override ({row.overrides.length})</span>
                                        <span className="text-[9px] opacity-70">{isExpanded ? "▲" : "▼"}</span>
                                      </button>
                                    )}
                                    {row.matchType === "NEW" && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                        + New Supplier
                                      </span>
                                    )}
                                    {row.matchType === "IDENTICAL" && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 text-[10px] font-medium border border-slate-500/20">
                                        ✓ Identical
                                      </span>
                                    )}
                                  </td>

                                  {/* Supplier Name */}
                                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                                    {overridesMap.has("name") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("name")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">{row.name}</div>
                                      </div>
                                    ) : (
                                      row.name || <span className="text-rose-500 font-normal">Missing Name</span>
                                    )}
                                  </td>

                                  {/* Vendor Code */}
                                  <td className="py-2.5 px-4">
                                    {overridesMap.has("code") ? (
                                      <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                        <span className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("code")?.oldValue}</span>
                                        <span className="text-slate-400 text-[10px]">→</span>
                                        <span className="text-emerald-500 font-bold font-mono text-[11px]">{row.code}</span>
                                      </div>
                                    ) : (
                                      <span className="font-mono text-[11px] opacity-75">{row.code || "—"}</span>
                                    )}
                                  </td>

                                  {/* Contact Person */}
                                  <td className="py-2.5 px-4">
                                    {overridesMap.has("contactPerson") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("contactPerson")?.oldValue}</div>
                                        <div className="text-emerald-500 font-medium text-[11px]">{row.contactPerson}</div>
                                      </div>
                                    ) : (
                                      <span>{row.contactPerson || "—"}</span>
                                    )}
                                  </td>

                                  {/* Email & Phone */}
                                  <td className="py-2.5 px-4">
                                    <div className="space-y-0.5">
                                      {overridesMap.has("email") ? (
                                        <div className="text-[11px]">
                                          <span className="line-through text-rose-500 opacity-60 text-[10px] block">{overridesMap.get("email")?.oldValue}</span>
                                          <span className="text-emerald-500 font-medium">{row.email}</span>
                                        </div>
                                      ) : row.email ? (
                                        <div className="text-[11px] text-[#0071E3] dark:text-[#58A6FF]">{row.email}</div>
                                      ) : null}

                                      {overridesMap.has("phone") ? (
                                        <div className="text-[11px]">
                                          <span className="line-through text-rose-500 opacity-60 text-[10px] block">{overridesMap.get("phone")?.oldValue}</span>
                                          <span className="text-emerald-500 font-medium">{row.phone}</span>
                                        </div>
                                      ) : row.phone ? (
                                        <div className="text-[11px] opacity-75">{row.phone}</div>
                                      ) : null}

                                      {!row.email && !row.phone && !overridesMap.has("email") && !overridesMap.has("phone") && (
                                        <span className="opacity-40">—</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Payment Terms */}
                                  <td className="py-2.5 px-4">
                                    {overridesMap.has("paymentTerms") ? (
                                      <div className="space-y-0.5">
                                        <span className="line-through text-rose-500 opacity-60 text-[10px] block">{overridesMap.get("paymentTerms")?.oldValue}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono text-[10px] font-bold border border-emerald-500/20">
                                          {row.paymentTerms || "NET30"}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-medium">
                                        {row.paymentTerms || "NET30"}
                                      </span>
                                    )}
                                  </td>

                                  {/* Tax ID */}
                                  <td className="py-2.5 px-4">
                                    {overridesMap.has("taxId") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("taxId")?.oldValue}</div>
                                        <div className="text-emerald-500 font-mono font-medium text-[11px]">{row.taxId}</div>
                                      </div>
                                    ) : (
                                      <span className="font-mono text-[11px] opacity-75">{row.taxId || "—"}</span>
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="py-2.5 px-4">
                                    {overridesMap.has("status") ? (
                                      <div className="space-y-0.5">
                                        <span className="line-through text-rose-500 opacity-60 text-[10px] block">{overridesMap.get("status")?.oldValue}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                          {row.status || "ACTIVE"}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${
                                        (row.status || "ACTIVE") === "ACTIVE"
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                          : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                      }`}>
                                        {row.status || "ACTIVE"}
                                      </span>
                                    )}
                                  </td>

                                  {/* Notes */}
                                  <td className="py-2.5 px-4 opacity-70 truncate max-w-xs text-[11px]">
                                    {overridesMap.has("notes") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("notes")?.oldValue}</div>
                                        <div className="text-emerald-500">{row.notes}</div>
                                      </div>
                                    ) : (
                                      row.notes || "—"
                                    )}
                                  </td>
                                </tr>

                                {/* Collapsible Overrides Drawer */}
                                {isExpanded && row.overrides && row.overrides.length > 0 && (
                                  <tr className={isDark ? "bg-[#141A29]/80" : "bg-amber-50/40"}>
                                    <td colSpan={11} className="p-3 sm:p-4">
                                      <div className={`p-3 sm:p-4 rounded-xl border space-y-2.5 text-xs ${
                                        isDark ? "bg-[#0B0E17] border-white/[0.08]" : "bg-white border-amber-200 shadow-xs"
                                      }`}>
                                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                                          <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="font-bold text-slate-900 dark:text-white">
                                              Overriding Data for &quot;{row.matchedVendorName || row.name}&quot;
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500">
                                              {row.overrides.length} {row.overrides.length === 1 ? "Field" : "Fields"} Modified
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setExpandedDiffRowIdx(null)}
                                            className="text-[11px] opacity-60 hover:opacity-100 cursor-pointer"
                                          >
                                            Close diff view ✕
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                          {row.overrides.map((ov: any, oIdx: number) => (
                                            <div key={oIdx} className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                                              isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                                            }`}>
                                              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">{ov.label}</span>
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                  <span className="text-[10px] opacity-50 w-14 shrink-0">Current:</span>
                                                  <span className="line-through text-rose-500 truncate font-mono">{ov.oldValue}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                  <span className="text-[10px] text-emerald-500 w-14 shrink-0 font-bold">New:</span>
                                                  <span className="text-emerald-500 font-bold truncate font-mono">{ov.newValue}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(null);
                          setParsedVendorRows([]);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer text-center ${
                          isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Cancel
                      </button>

                      <div className="flex items-center justify-between sm:justify-end gap-4 flex-wrap">
                        <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Selected: <span className="font-bold text-slate-900 dark:text-white">{selectedCount}</span> of {totalRows} suppliers
                          {selectedUpdates > 0 && <span className="text-amber-500 font-semibold ml-1">({selectedUpdates} overrides)</span>}
                          {selectedNew > 0 && <span className="text-emerald-500 font-semibold ml-1">({selectedNew} new)</span>}
                        </span>
                        <button
                          type="button"
                          disabled={bulkImporting || selectedCount === 0}
                          onClick={handleConfirmVendorImport}
                          className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {bulkImporting ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Processing Overrides &amp; Imports...</span>
                            </>
                          ) : (
                            <span>Confirm &amp; Import ({selectedCount} Selected)</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* STEP 3: IMPORT REPORT RESULTS SUMMARY */}
              {vendorImportReport && (
                <div className="flex-1 min-h-0 flex flex-col space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setVendorReportTab("updated")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        vendorReportTab === "updated"
                          ? "bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-blue-500 flex items-center gap-1">
                        <span>⚡ Updated</span>
                      </div>
                      <div className="text-xl font-extrabold text-blue-500 mt-1">{vendorImportReport.updated?.length || 0}</div>
                      <div className="text-[10px] opacity-60">Overridden &amp; synced</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVendorReportTab("added")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        vendorReportTab === "added"
                          ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                        <span>+ Added</span>
                      </div>
                      <div className="text-xl font-extrabold text-emerald-500 mt-1">{vendorImportReport.added.length}</div>
                      <div className="text-[10px] opacity-60">Successfully created</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVendorReportTab("skipped")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        vendorReportTab === "skipped"
                          ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        <span>Skipped</span>
                      </div>
                      <div className="text-xl font-extrabold text-amber-500 mt-1">{vendorImportReport.skipped.length}</div>
                      <div className="text-[10px] opacity-60">Identical or unselected</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVendorReportTab("failed")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        vendorReportTab === "failed"
                          ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-rose-500 flex items-center gap-1">
                        <span>Failed</span>
                      </div>
                      <div className="text-xl font-extrabold text-rose-500 mt-1">{vendorImportReport.failed.length}</div>
                      <div className="text-[10px] opacity-60">Validation errors</div>
                    </button>
                  </div>

                  <div className={`p-4 rounded-2xl border text-xs flex-1 min-h-0 overflow-y-auto ${isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                    {vendorReportTab === "updated" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-blue-500 mb-2">Updated Suppliers with Overrides ({vendorImportReport.updated?.length || 0})</div>
                        {(!vendorImportReport.updated || vendorImportReport.updated.length === 0) ? (
                          <p className="opacity-50">No existing suppliers were updated.</p>
                        ) : (
                          vendorImportReport.updated.map((item, idx) => (
                            <div key={idx} className="p-3 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-white/[0.02] space-y-1.5">
                              <div className="flex justify-between items-center flex-wrap gap-2">
                                <span className="font-semibold text-slate-900 dark:text-white">Row {item.row}: {item.name}</span>
                                {item.code && (
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                                    Code: {item.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {item.overrides.map((ov, oIdx) => (
                                  <span key={oIdx} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                                    <span className="opacity-70">{ov.label}:</span>
                                    <span className="line-through text-rose-500 opacity-60">{ov.oldValue}</span>
                                    <span>→</span>
                                    <span className="font-bold text-emerald-500">{ov.newValue}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {vendorReportTab === "added" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-emerald-500 mb-2">Successfully Created Suppliers ({vendorImportReport.added.length})</div>
                        {vendorImportReport.added.length === 0 ? (
                          <p className="opacity-50">No new suppliers were added.</p>
                        ) : (
                          vendorImportReport.added.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <span className="font-medium">Row {item.row}: {item.name}</span>
                              {item.code && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                                  Code: {item.code}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {vendorReportTab === "skipped" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-amber-500 mb-2">Skipped Suppliers ({vendorImportReport.skipped.length})</div>
                        {vendorImportReport.skipped.length === 0 ? (
                          <p className="opacity-50">No duplicate suppliers skipped.</p>
                        ) : (
                          vendorImportReport.skipped.map((item, idx) => (
                            <div key={idx} className="space-y-0.5 py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="font-medium">Row {item.row}: {item.name}</div>
                              <p className="text-[11px] text-amber-500/80">{item.reason}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {vendorReportTab === "failed" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-rose-500 mb-2">Failed Validation Rows ({vendorImportReport.failed.length})</div>
                        {vendorImportReport.failed.length === 0 ? (
                          <p className="opacity-50">No validation errors occurred!</p>
                        ) : (
                          vendorImportReport.failed.map((item, idx) => (
                            <div key={idx} className="space-y-0.5 py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="font-medium">Row {item.row}: {item.name}</div>
                              <p className="text-[11px] text-rose-400">{item.reason}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setVendorImportReport(null);
                        setPreviewFile(null);
                        setParsedVendorRows([]);
                      }}
                      className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Upload Another File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkModal(false);
                        setVendorImportReport(null);
                        setPreviewFile(null);
                        setParsedVendorRows([]);
                      }}
                      className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Done &amp; Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
