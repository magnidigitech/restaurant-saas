"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Outlet {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  profilePhotoUrl?: string;
  workerType?: string;
  weeklyHoursLimit?: number | null;
  employmentRecords?: Array<{
    department?: { id: string; name: string } | null;
    designation?: { id: string; name: string } | null;
    primaryOutlet?: { id: string; name: string } | null;
  }>;
}

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
}

interface ShiftAssignment {
  id: string;
  rosterId?: string | null;
  employeeId: string;
  outletId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  employee?: Employee;
  template?: ShiftTemplate;
  roster?: { id: string; name: string; status: string };
}

interface ShiftRoster {
  id: string;
  name: string;
  outletId: string;
  startDate: string;
  endDate: string;
  availabilityDeadline?: string | null;
  departments?: string[] | null;
  status: "DRAFT" | "AVAILABILITY_OPEN" | "AVAILABILITY_LOCKED" | "ASSIGNMENT_IN_PROGRESS" | "PUBLISHED" | "COMPLETED" | "ARCHIVED";
  outlet?: { name: string };
  _count?: { assignments: number };
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant: "danger" | "primary" | "warning";
  onConfirm: () => Promise<void> | void;
}

interface SuggestionItem {
  employeeId: string;
  name: string;
  employeeCode: string;
  profilePhotoUrl?: string;
  departmentName: string;
  designationName: string;
  weeklyHoursAssigned: number;
  weeklyShiftCount: number;
  maxWeeklyHours: number;
  availabilityType: "AVAILABLE" | "NOT_AVAILABLE" | "SPECIFIC_TIME" | "LEAVE" | "NOT_UPDATED";
  availableFrom?: string | null;
  availableUntil?: string | null;
  reason?: string;
}

export default function AppleShiftRostersPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  // Primary Workspace Data State
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [rosters, setRosters] = useState<ShiftRoster[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);

  const [selectedOutlet, setSelectedOutlet] = useState<string>("");
  const [selectedRosterId, setSelectedRosterId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"MY_SCHEDULE" | "ASSIGNMENTS" | "ADMIN_AVAILABILITY" | "MY_AVAILABILITY">("ASSIGNMENTS");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [overrideHoursLimit, setOverrideHoursLimit] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Modals state
  const [newRosterModalOpen, setNewRosterModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [submitConfirmModalOpen, setSubmitConfirmModalOpen] = useState(false);

  // Custom Modal Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmVariant: "primary",
    onConfirm: () => { },
  });

  // New Roster Form State
  const [rosterName, setRosterName] = useState("");
  const [rosterStart, setRosterStart] = useState("");
  const [rosterEnd, setRosterEnd] = useState("");
  const [rosterDeadline, setRosterDeadline] = useState("");
  const [rosterOutlet, setRosterOutlet] = useState("");

  // Employee Availability Portal State (View 3: My Availability)
  const [myEmployeeId, setMyEmployeeId] = useState<string>("");
  const [myDateAvailabilities, setMyDateAvailabilities] = useState<Record<string, {
    type: "AVAILABLE" | "NOT_AVAILABLE" | "SPECIFIC_TIME" | "LEAVE" | "NOT_UPDATED";
    availableFrom: string;
    availableUntil: string;
    notes: string;
  }>>({});
  const [mySubmissionStatus, setMySubmissionStatus] = useState<string>("DRAFT");
  const [mySubmittedAt, setMySubmittedAt] = useState<string | null>(null);
  const [mySubmissionNotes, setMySubmissionNotes] = useState("");

  // Recurring Weekly Pattern State
  const [recurringPattern, setRecurringPattern] = useState<Array<{
    dayOfWeek: number;
    isAvailable: boolean;
    preferredStartTime?: string;
    preferredEndTime?: string;
  }>>([
    { dayOfWeek: 1, isAvailable: true }, // Mon
    { dayOfWeek: 2, isAvailable: true }, // Tue
    { dayOfWeek: 3, isAvailable: true }, // Wed
    { dayOfWeek: 4, isAvailable: true }, // Thu
    { dayOfWeek: 5, isAvailable: true }, // Fri
    { dayOfWeek: 6, isAvailable: false }, // Sat
    { dayOfWeek: 0, isAvailable: false }, // Sun
  ]);

  // Admin Availability Dashboard State
  const [adminAvailData, setAdminAvailData] = useState<{
    dates: string[];
    availabilities: Array<{
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        profilePhotoUrl?: string;
        department: string;
        departmentId?: string;
        designation: string;
      };
      submissionStatus: string;
      submittedAt: string | null;
      days: Record<string, {
        type: string;
        isAvailable: boolean;
        label: string;
        availableFrom?: string | null;
        availableUntil?: string | null;
        notes?: string | null;
      }>;
    }>;
  }>({ dates: [], availabilities: [] });

  const [filterDepartment, setFilterDepartment] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState("");

  // Smart Assignment Modal State
  const [assignDate, setAssignDate] = useState("");
  const [assignStartTime, setAssignStartTime] = useState("09:00");
  const [assignEndTime, setAssignEndTime] = useState("17:00");
  const [assignBreak, setAssignBreak] = useState(30);
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [selectedEmployeesForShift, setSelectedEmployeesForShift] = useState<string[]>([]);
  const [assignOverrideWarning, setAssignOverrideWarning] = useState<string | null>(null);
  const [assignmentsViewMode, setAssignmentsViewMode] = useState<"CALENDAR" | "LIST">("CALENDAR");

  // Smart Staff Suggestions Data
  const [smartSuggestions, setSmartSuggestions] = useState<{
    recommended: SuggestionItem[];
    partiallyAvailable: SuggestionItem[];
    unavailable: SuggestionItem[];
  }>({ recommended: [], partiallyAvailable: [], unavailable: [] });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Fetch Outlets, Employees, Templates, and Active Rosters
  const fetchMasterData = async (isBackground: boolean = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);
      const [resModules, resOutlets, resEmps, resTmpls, resRosters] = await Promise.all([
        fetch("/api/restaurant/modules"),
        fetch("/api/restaurant/outlets"),
        fetch("/api/restaurant/employees"),
        fetch("/api/restaurant/shifts/templates"),
        fetch("/api/restaurant/shifts/rosters"),
      ]);

      const dataModules = await resModules.json();
      const isUserAdmin = Boolean(dataModules?.isAdmin);
      setIsAdmin(isUserAdmin);

      const dataOutlets = await resOutlets.json();
      const dataEmps = await resEmps.json();
      const dataTmpls = await resTmpls.json();
      const dataRosters = await resRosters.json();

      if (resOutlets.ok && Array.isArray(dataOutlets.outlets)) {
        setOutlets(dataOutlets.outlets);
        if (dataOutlets.outlets.length > 0) {
          if (!selectedOutlet) setSelectedOutlet(dataOutlets.outlets[0].id);
          if (!rosterOutlet) setRosterOutlet(dataOutlets.outlets[0].id);
        }
      }

      if (resEmps.ok && Array.isArray(dataEmps.employees)) {
        setEmployees(dataEmps.employees);
      }

      if (dataModules?.employeeId) {
        setMyEmployeeId(dataModules.employeeId);
      } else if (resEmps.ok && Array.isArray(dataEmps.employees) && dataEmps.employees.length > 0) {
        setMyEmployeeId(dataEmps.employees[0].id);
      }

      if (!isBackground) {
        if (!isUserAdmin) {
          setActiveTab("MY_SCHEDULE");
        } else {
          setActiveTab("ASSIGNMENTS");
        }
      }

      if (resTmpls.ok && Array.isArray(dataTmpls.templates)) {
        setTemplates(dataTmpls.templates);
      }

      if (resRosters.ok && Array.isArray(dataRosters.rosters)) {
        setRosters(dataRosters.rosters);
        const filtered = isUserAdmin
          ? dataRosters.rosters
          : dataRosters.rosters.filter((r: any) => r.status !== "DRAFT" && r.status !== "ARCHIVED");
        if (filtered.length > 0) {
          setSelectedRosterId((prev) => (filtered.some((r: any) => r.id === prev) ? prev : filtered[0].id));
        } else {
          setSelectedRosterId("");
        }
      }
    } catch (err: any) {
      if (!isBackground) setError("Failed to load initial shift roster data");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Real-time Background AJAX Polling & Window Focus Auto-Sync
  useEffect(() => {
    if (!selectedRosterId) return;

    const refreshData = () => {
      if (!actionLoading) {
        fetchMasterData(true);
        fetchRosterDetails(selectedRosterId);
        fetchMyAvailability(selectedRosterId, true);
      }
    };

    // 1. Sync immediately on window focus or tab visibility change
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        refreshData();
      }
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    // 2. Periodic background polling every 12 seconds for live sync without server load
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshData();
      }
    }, 12000);

    return () => {
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      clearInterval(timer);
    };
  }, [selectedRosterId, actionLoading]);

  // Fetch Assignments & Availability when selected roster changes
  const fetchRosterDetails = async (rosterId: string) => {
    if (!rosterId) return;
    try {
      const [resAssignments, resAvail] = await Promise.all([
        fetch(`/api/restaurant/shifts/assignments?rosterId=${rosterId}`),
        fetch(`/api/restaurant/shifts/rosters/${rosterId}/availability`),
      ]);

      const dataAssignments = await resAssignments.json();
      const dataAvail = await resAvail.json();

      if (resAssignments.ok && Array.isArray(dataAssignments.assignments)) {
        setAssignments(dataAssignments.assignments);
      }

      if (resAvail.ok && dataAvail.availabilities) {
        setAdminAvailData(dataAvail);
      }
    } catch {
      // silent catch for sub-fetch
    }
  };

  // Fetch Employee's Personal Availability Portal Data
  const fetchMyAvailability = async (rosterId: string, isBackground: boolean = false) => {
    if (!rosterId) return;
    try {
      const res = await fetch(`/api/restaurant/shifts/rosters/${rosterId}/my-availability`);
      const data = await res.json();
      if (res.ok) {
        if (data.employee) setMyEmployeeId(data.employee.id);
        if (data.myAvailability) {
          setMySubmissionStatus(data.myAvailability.submissionStatus || "DRAFT");
          setMySubmittedAt(data.myAvailability.submittedAt || null);

          // Populate daily map on initial load (don't overwrite active user edits during background polling)
          if (!isBackground || Object.keys(myDateAvailabilities).length === 0) {
            const dailyMap: Record<string, any> = {};
            if (data.myAvailability.days) {
              Object.entries(data.myAvailability.days).forEach(([dStr, val]: [string, any]) => {
                dailyMap[dStr] = {
                  type: val.type || "NOT_UPDATED",
                  availableFrom: val.availableFrom || "09:00",
                  availableUntil: val.availableUntil || "17:00",
                  notes: val.notes || "",
                };
              });
            }
            setMyDateAvailabilities(dailyMap);
          }
        }
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (selectedRosterId) {
      fetchRosterDetails(selectedRosterId);
      if (activeTab === "MY_AVAILABILITY") {
        fetchMyAvailability(selectedRosterId);
      }
    }
  }, [selectedRosterId, activeTab]);

  // Fetch Smart Staff Suggestions when assignment params change in modal
  const fetchSuggestions = async () => {
    if (!selectedRosterId || !assignDate) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `/api/restaurant/shifts/rosters/${selectedRosterId}/suggestions?shiftDate=${assignDate}&startTime=${assignStartTime}&endTime=${assignEndTime}`
      );
      const data = await res.json();
      if (res.ok) {
        setSmartSuggestions(data);
        // Auto-select recommended employees by default
        if (data.recommended && data.recommended.length > 0) {
          setSelectedEmployeesForShift(data.recommended.map((emp: any) => emp.employeeId));
          setAssignOverrideWarning(null);
        } else {
          setSelectedEmployeesForShift([]);
          setAssignOverrideWarning(null);
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (assignModalOpen && assignDate && selectedRosterId) {
      fetchSuggestions();
    }
  }, [assignModalOpen, assignDate, assignStartTime, assignEndTime]);

  // Helper Confirmation Dialog
  const openConfirm = (
    title: string,
    message: string,
    confirmText: string,
    confirmVariant: "danger" | "primary" | "warning",
    onConfirm: () => Promise<void> | void
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      confirmVariant,
      onConfirm,
    });
  };

  const visibleRosters = React.useMemo(() => {
    return isAdmin ? rosters : rosters.filter((r) => r.status !== "DRAFT" && r.status !== "ARCHIVED");
  }, [rosters, isAdmin]);

  const currentRoster = visibleRosters.find((r) => r.id === selectedRosterId) || (visibleRosters.length > 0 ? visibleRosters[0] : undefined);

  // 1. Create New Roster Period
  const handleCreateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveOutlet = rosterOutlet || selectedOutlet || (outlets.length > 0 ? outlets[0].id : "");
    if (!rosterName || !rosterStart || !rosterEnd || !effectiveOutlet) {
      setError("Please fill out all required roster period fields");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/restaurant/shifts/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rosterName.trim(),
          outletId: effectiveOutlet,
          startDate: rosterStart,
          endDate: rosterEnd,
          availabilityDeadline: rosterDeadline || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create roster period");

      setNewRosterModalOpen(false);
      setRosterName("");
      setRosterStart("");
      setRosterEnd("");
      setRosterDeadline("");
      await fetchMasterData();
      if (data.roster?.id) {
        setSelectedRosterId(data.roster.id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create roster period");
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow Status Transition Handler
  const handleUpdateRosterStatus = async (newStatus: string) => {
    if (!selectedRosterId) return;
    setConfirmDialog({
      isOpen: true,
      title: "Update Roster Workflow Stage",
      message: `Are you sure you want to transition this roster stage to "${newStatus.replace(/_/g, " ")}"?`,
      confirmText: "Update Stage",
      confirmVariant: newStatus === "PUBLISHED" ? "primary" : "warning",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
          let data: any = {};
          try {
            data = await res.json();
          } catch {
            data = {};
          }
          if (!res.ok) throw new Error(data.error || `Failed to update roster status (HTTP ${res.status})`);
          showToast(`✓ Roster stage updated to ${newStatus.replace(/_/g, " ")}`, "success");
          await fetchMasterData();
          await fetchRosterDetails(selectedRosterId);
          await fetchMyAvailability(selectedRosterId);
        } catch (err: any) {
          showToast(err.message || "Failed to update status", "error");
          setError(err.message || "Failed to update status");
        }
      },
    });
  };

  // 2 & 6. Employee Availability Submission
  const handleSaveEmployeeAvailability = async () => {
    if (!selectedRosterId) return;
    setActionLoading(true);
    setError(null);
    try {
      const datesPayload = Object.entries(myDateAvailabilities)
        .filter(([_, val]) => val.type && val.type !== "NOT_UPDATED")
        .map(([dStr, val]) => ({
          date: dStr,
          type: val.type,
          availableFrom: val.type === "SPECIFIC_TIME" ? val.availableFrom : undefined,
          availableUntil: val.type === "SPECIFIC_TIME" ? val.availableUntil : undefined,
          notes: val.notes || undefined,
        }));

      if (datesPayload.length > 0) {
        const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_dates",
            dateAvailabilities: datesPayload,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save availability");
      }
      await fetchMyAvailability(selectedRosterId);
    } catch (err: any) {
      setError(err.message || "Failed to save availability");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyRecurringAvailability = async () => {
    if (!selectedRosterId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_recurring" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply recurring availability");
      showToast("✓ Recurring weekly availability applied to roster!", "success");
      await fetchMyAvailability(selectedRosterId);
    } catch (err: any) {
      showToast(err.message || "Failed to apply recurring pattern", "error");
      setError(err.message || "Failed to apply recurring pattern");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitFinalAvailability = async () => {
    if (!selectedRosterId) {
      setModalError("No roster selected");
      return;
    }
    setActionLoading(true);
    setModalError(null);
    setError(null);
    try {
      // 1. Save valid date selections
      const datesPayload = Object.entries(myDateAvailabilities)
        .filter(([_, val]) => val.type && val.type !== "NOT_UPDATED")
        .map(([dStr, val]) => ({
          date: dStr,
          type: val.type,
          availableFrom: val.type === "SPECIFIC_TIME" ? val.availableFrom : undefined,
          availableUntil: val.type === "SPECIFIC_TIME" ? val.availableUntil : undefined,
          notes: val.notes || undefined,
        }));

      if (datesPayload.length > 0) {
        const resSave = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_dates",
            employeeId: myEmployeeId || undefined,
            dateAvailabilities: datesPayload,
          }),
        });
        const dataSave = await resSave.json();
        if (!resSave.ok) throw new Error(dataSave.error || "Failed to save availability dates");
      }

      // 2. Submit final availability
      const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          employeeId: myEmployeeId || undefined,
          notes: mySubmissionNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit availability");

      setMySubmissionStatus("SUBMITTED");
      setMySubmittedAt(new Date().toISOString());
      setSubmitConfirmModalOpen(false);
      showToast("✓ Schedule availability submitted successfully to your manager!", "success");
      await fetchMyAvailability(selectedRosterId);
      if (activeTab === "ADMIN_AVAILABILITY") {
        await fetchRosterDetails(selectedRosterId);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to submit availability", "error");
      setModalError(err.message || "Failed to submit availability");
    } finally {
      setActionLoading(false);
    }
  };

  // 8 & 9. Admin Assigns Shifts
  const handleAssignShift = async (e?: React.FormEvent, forceOverride: boolean = false) => {
    if (e) e.preventDefault();
    if (selectedEmployeesForShift.length === 0 || !assignDate || !assignStartTime || !assignEndTime || !selectedOutlet) {
      setModalError("Please select at least one employee and fill in all shift assignment details");
      return;
    }

    setActionLoading(true);
    setModalError(null);
    setError(null);
    try {
      const shouldOverride = forceOverride || overrideHoursLimit;
      const assignmentsPayload = selectedEmployeesForShift.map((empId) => ({
        rosterId: selectedRosterId,
        employeeId: empId,
        outletId: selectedOutlet,
        shiftDate: assignDate,
        startTime: assignStartTime,
        endTime: assignEndTime,
        breakMinutes: Number(assignBreak),
        templateId: assignTemplateId || undefined,
        overrideHoursLimit: shouldOverride,
      }));

      const res = await fetch("/api/restaurant/shifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: assignmentsPayload,
          overrideHoursLimit: shouldOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign shifts");

      showToast(`✓ Shift successfully assigned to ${selectedEmployeesForShift.length} staff!`, "success");
      setAssignModalOpen(false);
      setSelectedEmployeesForShift([]);
      setOverrideHoursLimit(false);
      await fetchRosterDetails(selectedRosterId);
      await fetchMyAvailability(selectedRosterId);
    } catch (err: any) {
      setModalError(err.message || "Failed to assign shift");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to remove this shift assignment?")) return;
    try {
      const res = await fetch(`/api/restaurant/shifts/assignments?id=${assignmentId}`, {
        method: "DELETE",
      });
      if (res.ok && selectedRosterId) {
        showToast("✓ Shift assignment removed", "success");
        await fetchRosterDetails(selectedRosterId);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete shift assignment", "error");
        setError(data.error || "Failed to delete shift assignment");
      }
    } catch {
      setError("Failed to delete shift assignment");
    }
  };

  // Filter Admin Availability Matrix
  const filteredAdminAvailabilities = adminAvailData.availabilities.filter((item) => {
    if (filterDepartment !== "ALL" && item.employee.departmentId !== filterDepartment) return false;
    if (searchEmployeeQuery.trim()) {
      const query = searchEmployeeQuery.toLowerCase();
      const name = `${item.employee.firstName} ${item.employee.lastName}`.toLowerCase();
      const code = item.employee.employeeCode.toLowerCase();
      if (!name.includes(query) && !code.includes(query)) return false;
    }
    return true;
  });

  // Calculate Roster Period Dates List
  const rosterDatesList: string[] = [];
  if (currentRoster) {
    const s = new Date(currentRoster.startDate);
    const e = new Date(currentRoster.endDate);
    const c = new Date(s);
    while (c <= e) {
      rosterDatesList.push(c.toISOString().split("T")[0]);
      c.setUTCDate(c.getUTCDate() + 1);
    }
  }

  const isRosterPublished = currentRoster?.status === "PUBLISHED";
  const isAvailabilityLocked =
    currentRoster?.status === "AVAILABILITY_LOCKED" ||
    currentRoster?.status === "ASSIGNMENT_IN_PROGRESS" ||
    currentRoster?.status === "PUBLISHED" ||
    currentRoster?.status === "COMPLETED";

  function matchesDate(shiftDateStr: string, targetDateStr: string): boolean {
    if (!shiftDateStr || !targetDateStr) return false;
    try {
      if (shiftDateStr.startsWith(targetDateStr)) return true;
      const aDateStr = new Date(shiftDateStr).toISOString().split("T")[0];
      const localDate = new Date(shiftDateStr).toLocaleDateString("en-CA");
      return aDateStr === targetDateStr || localDate === targetDateStr;
    } catch {
      return false;
    }
  }

  // Employee's personal shifts (Filtered strictly to active shifts within this roster period)
  const myShifts = React.useMemo(() => {
    if (!myEmployeeId) return [];
    if (!isAdmin && !isRosterPublished) return [];
    return assignments.filter((a) => {
      if (a.employeeId !== myEmployeeId) return false;
      if (a.status === "CANCELLED") return false;
      const assignmentRosterId = a.roster?.id || a.rosterId;
      if (selectedRosterId && assignmentRosterId && assignmentRosterId !== selectedRosterId) return false;
      if (rosterDatesList.length > 0) {
        return rosterDatesList.some((dStr) => matchesDate(a.shiftDate, dStr));
      }
      return true;
    });
  }, [assignments, myEmployeeId, isAdmin, isRosterPublished, selectedRosterId, rosterDatesList]);

  const myEmployeeRecord = React.useMemo(() => {
    return employees.find((e) => e.id === myEmployeeId);
  }, [employees, myEmployeeId]);

  const myTotalHours = React.useMemo(() => {
    if (!isAdmin && !isRosterPublished) return 0;
    let total = 0;
    for (const s of myShifts) {
      if (s.startTime && s.endTime) {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        let mins = eh * 60 + em - (sh * 60 + sm);
        if (mins < 0) mins += 24 * 60;
        mins -= s.breakMinutes || 0;
        if (mins > 0) total += mins / 60;
      }
    }
    return Math.round(total * 10) / 10;
  }, [myShifts, isAdmin, isRosterPublished]);

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"}`}>
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Shift Roster System...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="Shifts & Rosters">
      <div className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"}`}>
        <RestaurantNavbar activeSection="Shifts" />

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 min-w-0 overflow-x-hidden">
          {/* Executive Roster Header Banner */}
          <div className={`p-5 sm:p-7 rounded-3xl border transition flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 min-w-0 max-w-full ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"}`}>
            <div className="space-y-2 w-full lg:w-auto min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)} className={`text-xs font-medium transition cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"}`}>
                  ← Dashboard
                </button>
                <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
                <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {isAdmin ? "Workforce Roster Console" : "My Shift Schedule"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight break-words ${isDark ? "text-white" : "text-slate-900"}`}>
                  {isAdmin
                    ? (currentRoster ? currentRoster.name : "Shift Rosters")
                    : (currentRoster ? `${currentRoster.name}` : "My Shift Schedule")}
                </h1>
                {currentRoster && (
                  <span className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg uppercase tracking-wide border whitespace-nowrap ${currentRoster.status === "PUBLISHED"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : currentRoster.status === "AVAILABILITY_OPEN"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : currentRoster.status === "AVAILABILITY_LOCKED"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    }`}>
                    {currentRoster.status.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {isAdmin
                  ? "Availability-First Roster Workflow: Employees submit schedule availability → Admin assigns shifts."
                  : "View your weekly scheduled working shifts and submit your schedule availability for upcoming roster periods."}
              </p>
            </div>

            {/* Roster Selection & Period Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto min-w-0 max-w-full">
              <select
                value={selectedRosterId}
                onChange={(e) => setSelectedRosterId(e.target.value)}
                disabled={visibleRosters.length === 0}
                className={`w-full sm:w-auto max-w-full min-w-0 px-3.5 py-2.5 sm:py-2 text-xs rounded-xl border font-medium focus:outline-none focus:border-[#0071E3] truncate ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
              >
                {visibleRosters.length === 0 ? (
                  <option value="">No Active Rosters Open</option>
                ) : (
                  visibleRosters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()})
                    </option>
                  ))
                )}
              </select>

              {isAdmin && (
                <button
                  onClick={() => setNewRosterModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer text-center whitespace-nowrap"
                >
                  + Create Roster Period
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-400 font-bold ml-2 cursor-pointer">✕</button>
            </div>
          )}

          {/* Workflow Status Stepper (Interactive for Admins) */}
          {isAdmin && currentRoster && (
            <div className={`p-5 rounded-3xl border transition space-y-3 ${isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
              <div className="flex justify-between items-center">
                <span className={`text-xs font-semibold ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Workflow Stage (Click stage to transition)
                </span>
                <div className="text-[11px] font-medium text-[#0071E3]">
                  Current: <strong>{currentRoster.status.replace(/_/g, " ")}</strong>
                </div>
              </div>

              {/* Stepper Visual / Interactive Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                {[
                  { key: "DRAFT", label: "1. Draft" },
                  { key: "AVAILABILITY_OPEN", label: "2. Availability Open" },
                  { key: "AVAILABILITY_LOCKED", label: "3. Availability Locked" },
                  { key: "ASSIGNMENT_IN_PROGRESS", label: "4. Assigning Shifts" },
                  { key: "PUBLISHED", label: "5. Published" },
                  { key: "COMPLETED", label: "6. Completed" },
                ].map((st) => {
                  const isActive = currentRoster.status === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => {
                        if (currentRoster.status !== st.key) {
                          handleUpdateRosterStatus(st.key);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-center text-xs font-medium transition cursor-pointer ${isActive
                        ? "bg-[#0071E3] border-[#0071E3] text-white shadow-md font-bold ring-2 ring-[#0071E3]/20"
                        : isDark
                          ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3] hover:border-white/20 hover:text-white"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state for employees when no rosters are open */}
          {!isAdmin && visibleRosters.length === 0 && (
            <div className={`p-10 sm:p-16 rounded-3xl border text-center space-y-4 ${isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                No Active Rosters Open
              </h3>
              <p className={`text-xs max-w-md mx-auto leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                There are currently no roster periods open for availability submission or published for viewing. Please check back when management opens a new scheduling period.
              </p>
            </div>
          )}

          {/* Navigation View Mode Tabs (Only when rosters are visible) */}
          {(isAdmin || visibleRosters.length > 0) && (
            <div className="flex border-b border-slate-200 dark:border-white/[0.08] gap-4 sm:gap-6 overflow-x-auto no-scrollbar min-w-0">
              {!isAdmin ? (
                <>
                  <button
                    onClick={() => setActiveTab("MY_SCHEDULE")}
                    className={`pb-3 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "MY_SCHEDULE"
                      ? "border-[#0071E3] text-[#0071E3]"
                      : isDark
                        ? "border-transparent text-[#8F95A3] hover:text-white"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    My Shifts & Schedule {isRosterPublished ? `(${myShifts.length})` : ""}
                  </button>

                  <button
                    onClick={() => setActiveTab("MY_AVAILABILITY")}
                    className={`pb-3 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "MY_AVAILABILITY"
                      ? "border-[#0071E3] text-[#0071E3]"
                      : isDark
                        ? "border-transparent text-[#8F95A3] hover:text-white"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    Submit My Availability
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab("ASSIGNMENTS")}
                    className={`pb-3 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "ASSIGNMENTS"
                      ? "border-[#0071E3] text-[#0071E3]"
                      : isDark
                        ? "border-transparent text-[#8F95A3] hover:text-white"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    Shift Planner (Weekly Grid) ({assignments.length})
                  </button>

                  <button
                    onClick={() => setActiveTab("ADMIN_AVAILABILITY")}
                    className={`pb-3 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "ADMIN_AVAILABILITY"
                      ? "border-[#0071E3] text-[#0071E3]"
                      : isDark
                        ? "border-transparent text-[#8F95A3] hover:text-white"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    Staff Availability Matrix
                  </button>

                  <button
                    onClick={() => setActiveTab("MY_AVAILABILITY")}
                    className={`pb-3 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "MY_AVAILABILITY"
                      ? "border-[#0071E3] text-[#0071E3]"
                      : isDark
                        ? "border-transparent text-[#8F95A3] hover:text-white"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    Staff Self-Service Preview
                  </button>
                </>
              )}
            </div>
          )}

          {/* TAB: EMPLOYEE PERSONAL SCHEDULE VIEW */}
          {activeTab === "MY_SCHEDULE" && (
            <div className="space-y-6">
              {/* Employee Summary Card */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-5 rounded-2xl border transition ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Scheduled Hours
                  </span>
                  <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {isRosterPublished ? `${myTotalHours}` : "0"}{" "}
                    <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>hrs</span>
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {isRosterPublished ? `Weekly Target: ${myEmployeeRecord?.weeklyHoursLimit || 40}h` : "Pending final publication"}
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border transition ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Shifts Assigned
                  </span>
                  <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {isRosterPublished ? `${myShifts.length}` : "0"}{" "}
                    <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>shifts</span>
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {isRosterPublished ? "Scheduled for this period" : "Awaiting manager publish"}
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border transition ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Roster Status
                  </span>
                  <p className={`text-lg font-bold tracking-tight mt-2 ${isRosterPublished ? "text-emerald-500" : "text-amber-500"}`}>
                    {currentRoster?.status ? currentRoster.status.replace(/_/g, " ") : "Draft"}
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {isRosterPublished ? "Live and finalized" : "Shift assignment in progress"}
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border transition flex flex-col justify-between ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                  <div>
                    <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Availability
                    </span>
                    <p className={`text-xs font-semibold mt-1.5 ${mySubmissionStatus === "SUBMITTED" ? "text-emerald-500" : "text-amber-500"}`}>
                      {mySubmissionStatus === "SUBMITTED" ? "Submitted" : "Pending Submission"}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("MY_AVAILABILITY")}
                    className="text-xs text-[#0071E3] hover:underline text-left font-medium cursor-pointer"
                  >
                    Edit Availability →
                  </button>
                </div>
              </div>

              {/* Day-by-Day Shift Cards or Unpublished Notice */}
              {!isRosterPublished ? (
                <div className={`p-8 rounded-3xl border text-center space-y-3 ${isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Roster In Progress
                  </h4>
                  <p className={`text-xs max-w-md mx-auto leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Management is currently preparing the schedule for this period ({currentRoster?.name || "Upcoming Week"}). Your assigned shifts and timings will appear here once published.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab("MY_AVAILABILITY")}
                      className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Submit / Update Your Availability →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Daily Shift Breakdown ({currentRoster?.name})
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rosterDatesList.map((dStr) => {
                      const dateObj = new Date(dStr);
                      const dayShifts = myShifts.filter((s) => matchesDate(s.shiftDate, dStr));
                      const isToday = new Date().toISOString().split("T")[0] === dStr;

                      return (
                        <div
                          key={dStr}
                          className={`p-5 rounded-3xl border transition flex flex-col justify-between space-y-4 ${dayShifts.length > 0
                            ? isDark
                              ? "bg-[#121622]/90 border-blue-500/30 shadow-md"
                              : "bg-white border-blue-200 shadow-sm"
                            : isDark
                              ? "bg-[#0A0C12]/50 border-white/[0.06]"
                              : "bg-slate-50/70 border-slate-200/70"
                            }`}
                        >
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {dateObj.toLocaleDateString(undefined, { weekday: "long" })}
                                </span>
                                {isToday && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#0071E3] text-white rounded-md">
                                    TODAY
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                {dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            </div>

                            {dayShifts.length > 0 ? (
                              <div className="space-y-2">
                                {dayShifts.map((shift) => (
                                  <div
                                    key={shift.id}
                                    className={`p-3.5 rounded-2xl border ${isDark
                                      ? "bg-blue-500/10 border-blue-500/20 text-white"
                                      : "bg-blue-50 border-blue-100 text-slate-900"
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-[#0071E3]">
                                        {shift.startTime} – {shift.endTime}
                                      </span>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        Confirmed
                                      </span>
                                    </div>

                                    {shift.template && (
                                      <div className="text-xs font-medium mt-1">
                                        {shift.template.name}
                                      </div>
                                    )}

                                    <div className={`text-[11px] mt-1.5 flex items-center justify-between ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                      <span>{shift.breakMinutes}m break</span>
                                      <span>{outlets.find((o) => o.id === shift.outletId)?.name || "Branch"}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="py-6 text-center space-y-1.5">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center mx-auto text-slate-400">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                  </svg>
                                </div>
                                <p className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  Rest Day / Day Off
                                </p>
                                <p className={`text-[10px] ${isDark ? "text-[#484E5E]" : "text-slate-400"}`}>
                                  No shift scheduled
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: ADMIN SHIFT ASSIGNMENTS WITH WEEKLY CALENDAR & SMART SUGGESTIONS */}
          {activeTab === "ASSIGNMENTS" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Shift Roster Schedule - {currentRoster?.name}
                  </h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Admin assigns shifts based on employee availability. Click "+ Add Shift" on any day card to assign.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* View Mode Switcher */}
                  <div className={`p-1 rounded-xl border flex gap-1 ${isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                    <button
                      onClick={() => setAssignmentsViewMode("CALENDAR")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${assignmentsViewMode === "CALENDAR"
                        ? "bg-[#0071E3] text-white shadow-sm"
                        : isDark
                          ? "text-slate-400 hover:text-white"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      Calendar View
                    </button>
                    <button
                      onClick={() => setAssignmentsViewMode("LIST")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${assignmentsViewMode === "LIST"
                        ? "bg-[#0071E3] text-white shadow-sm"
                        : isDark
                          ? "text-slate-400 hover:text-white"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      ≡ List View
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setAssignDate(rosterDatesList[0] || new Date().toISOString().split("T")[0]);
                      setAssignModalOpen(true);
                    }}
                    disabled={!currentRoster}
                    className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>+ Assign New Shift</span>
                  </button>
                </div>
              </div>

              {/* MATRIX CALENDAR VIEW (Left: Employee Names, Top: Dates) */}
              {assignmentsViewMode === "CALENDAR" ? (
                <div className={`rounded-3xl border transition overflow-hidden shadow-xs ${isDark ? "bg-[#121622]/60 border-white/[0.08]" : "bg-white border-slate-200"}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[950px]">
                      <thead>
                        <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-white/[0.08] bg-[#0A0C12] text-[#8F95A3]" : "border-slate-200 bg-slate-50/90 text-slate-600"}`}>
                          {/* Sticky Left Column Header: Employees */}
                          <th className={`py-4 px-4 sticky left-0 z-20 min-w-[220px] border-r ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}>
                            Employee Name
                          </th>

                          {/* Date Columns Header */}
                          {rosterDatesList.map((dStr) => {
                            const dateObj = new Date(dStr);
                            const dayName = dateObj.toLocaleDateString(undefined, { weekday: "short" });
                            const dateNumStr = dateObj.toLocaleDateString(undefined, { day: "numeric", month: "short" });
                            return (
                              <th key={dStr} className={`py-3 px-3 text-center min-w-[130px] border-r last:border-r-0 ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}>
                                <div className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">{dayName}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{dateNumStr}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                        {employees.map((emp) => {
                          const deptName = emp.employmentRecords?.[0]?.department?.name || "General";

                          return (
                            <tr key={emp.id} className={isDark ? "hover:bg-white/[0.01]" : "hover:bg-slate-50/50"}>
                              {/* Left Sticky Cell: Employee Info */}
                              <td className={`py-3.5 px-4 sticky left-0 z-10 border-r shadow-xs ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {emp.firstName} {emp.lastName}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {emp.employeeCode} • {deptName}
                                </div>
                              </td>

                              {/* Date Cells */}
                              {rosterDatesList.map((dStr) => {
                                // Find shift assignment for this employee on this date
                                const empShift = assignments.find((a) => {
                                  const aDateStr = new Date(a.shiftDate).toISOString().split("T")[0];
                                  return a.employeeId === emp.id && aDateStr === dStr;
                                });

                                // Check availability for this employee on this date
                                const empAvail = adminAvailData.availabilities.find(a => a.employee.id === emp.id);
                                const dayAvail = empAvail?.days?.[dStr];
                                const availType = dayAvail?.type || "NOT_UPDATED";

                                return (
                                  <td key={dStr} className={`p-2 border-r last:border-r-0 align-top ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}>
                                    {empShift ? (
                                      /* Assigned Shift Card */
                                      <div className={`p-2.5 rounded-xl border transition space-y-1 relative group ${isDark ? "bg-[#0A0C12] border-blue-500/30 text-white" : "bg-blue-50/80 border-blue-200 text-slate-900"}`}>
                                        <div className="flex justify-between items-center">
                                          <span className="font-mono text-[11px] font-bold text-[#0071E3] dark:text-[#64B5FF]">
                                            {empShift.startTime} - {empShift.endTime}
                                          </span>
                                          <button
                                            onClick={() => handleDeleteAssignment(empShift.id)}
                                            title="Delete Shift"
                                            className="text-slate-400 hover:text-rose-500 text-xs p-0.5 cursor-pointer opacity-70 group-hover:opacity-100"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 pt-0.5">
                                          <span>{empShift.breakMinutes}m break</span>
                                          {availType === "AVAILABLE" && <span className="font-bold text-emerald-600 dark:text-emerald-400">Available</span>}
                                          {availType === "NOT_UPDATED" && <span className="font-medium text-amber-600 dark:text-amber-400">Pending</span>}
                                        </div>
                                      </div>
                                    ) : (
                                      /* Empty Cell with Availability Tag & + Add Shift Button */
                                      <div
                                        onClick={() => {
                                          setAssignDate(dStr);
                                          setSelectedEmployeesForShift([emp.id]);
                                          setAssignModalOpen(true);
                                        }}
                                        className={`p-2 rounded-xl border border-dashed transition cursor-pointer flex flex-col items-center justify-center space-y-1 min-h-[64px] ${isDark
                                          ? "border-white/10 hover:border-[#0071E3] bg-white/[0.01] hover:bg-blue-500/10"
                                          : "border-slate-200 hover:border-[#0071E3] bg-slate-50/40 hover:bg-blue-50/60"
                                          }`}
                                      >
                                        {/* Availability Indicator Tag */}
                                        {availType === "AVAILABLE" && (
                                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                            Available
                                          </span>
                                        )}
                                        {availType === "SPECIFIC_TIME" && (
                                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                            {dayAvail?.availableFrom || ""}-{dayAvail?.availableUntil || ""}
                                          </span>
                                        )}
                                        {availType === "NOT_AVAILABLE" && (
                                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                            Not Available
                                          </span>
                                        )}
                                        {availType === "LEAVE" && (
                                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                            Leave
                                          </span>
                                        )}
                                        {availType === "NOT_UPDATED" && (
                                          <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                            Pending
                                          </span>
                                        )}

                                        <span className="text-[10px] font-bold text-[#0071E3] dark:text-[#64B5FF] hover:underline flex items-center gap-0.5">
                                          + Add Shift
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* LIST VIEW TABLE */
                <div className={`p-6 rounded-3xl border transition space-y-4 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                  {assignments.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>No Shift Assignments Created Yet</p>
                      <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Review employee availability in the Availability Dashboard tab, then click "+ Assign New Shift" to assign employees.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-500"}`}>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Employee</th>
                            <th className="py-3 px-4">Shift Time</th>
                            <th className="py-3 px-4">Break</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                          {assignments.map((asgn) => (
                            <tr key={asgn.id} className={isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}>
                              <td className="py-3.5 px-4 font-semibold">
                                {new Date(asgn.shiftDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-semibold">{asgn.employee ? `${asgn.employee.firstName} ${asgn.employee.lastName}` : "Staff"}</div>
                                <div className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>{asgn.employee?.employeeCode}</div>
                              </td>
                              <td className="py-3.5 px-4 font-mono font-medium">
                                {asgn.startTime} - {asgn.endTime}
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 dark:text-[#8F95A3]">{asgn.breakMinutes} mins</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                  {asgn.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => handleDeleteAssignment(asgn.id)}
                                  className="text-rose-500 hover:text-rose-600 text-xs font-semibold cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADMIN AVAILABILITY DASHBOARD */}
          {activeTab === "ADMIN_AVAILABILITY" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Team Availability Overview
                  </h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Review employee availability responses before assigning shifts.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                    className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"}`}
                  />
                </div>
              </div>

              {/* Matrix Table */}
              <div className={`p-6 rounded-3xl border transition space-y-4 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-500"}`}>
                        <th className="py-3 px-4 min-w-[180px]">Employee</th>
                        <th className="py-3 px-4 min-w-[100px]">Submission</th>
                        {adminAvailData.dates.map((dStr) => (
                          <th key={dStr} className="py-3 px-3 text-center min-w-[110px]">
                            {new Date(dStr).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                      {filteredAdminAvailabilities.map((row) => (
                        <tr key={row.employee.id} className={isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold">{row.employee.firstName} {row.employee.lastName}</div>
                            <div className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>{row.employee.department} • {row.employee.employeeCode}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${row.submissionStatus === "SUBMITTED"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              }`}>
                              {row.submissionStatus}
                            </span>
                          </td>
                          {adminAvailData.dates.map((dStr) => {
                            const dayInfo = row.days[dStr] || { type: "NOT_UPDATED", label: "Not Updated" };
                            return (
                              <td key={dStr} className="py-3 px-2 text-center">
                                <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded-lg border w-full truncate ${dayInfo.type === "AVAILABLE"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : dayInfo.type === "NOT_AVAILABLE"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                    : dayInfo.type === "SPECIFIC_TIME"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                      : dayInfo.type === "LEAVE"
                                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold"
                                  }`}>
                                  {dayInfo.label}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EMPLOYEE AVAILABILITY & SCHEDULE PORTAL (Requirement 2, 3, 4, 5, 6) */}
          {activeTab === "MY_AVAILABILITY" && (
            <div className="space-y-5 sm:space-y-6 min-w-0 max-w-full">
              <div className="p-5 sm:p-6 rounded-3xl border bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent border-blue-500/20 space-y-3 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                  <h2 className={`text-base sm:text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Your Schedule & Availability
                  </h2>
                  <span className={`px-3 py-1 text-xs font-bold rounded-xl border self-start sm:self-auto ${isAvailabilityLocked
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : mySubmissionStatus === "SUBMITTED"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    }`}>
                    {isAvailabilityLocked ? "Window Closed" : `Status: ${mySubmissionStatus}`}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  {isAvailabilityLocked
                    ? "Availability submission is closed for this roster period. Management is now drafting or has published final shifts."
                    : "Please update your available working days and times for this roster period. You are only providing your availability; the manager will assign your final shifts."}
                </p>
                {isAvailabilityLocked && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-xl font-medium">
                    Availability is locked ({currentRoster?.status?.replace(/_/g, " ")}). Changes require manager authorization.
                  </div>
                )}
                {currentRoster?.availabilityDeadline && !isAvailabilityLocked && (
                  <p className="text-xs font-semibold text-amber-500">
                    Submission Deadline: {new Date(currentRoster.availabilityDeadline).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Recurring Pattern Controls */}
              <div className={`p-5 sm:p-6 rounded-3xl border transition space-y-3 sm:space-y-4 min-w-0 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Recurring Weekly Availability</h3>
                    <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Set your standard weekly working preference.</p>
                  </div>
                  <button
                    onClick={handleApplyRecurringAvailability}
                    disabled={isAvailabilityLocked || actionLoading}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer text-center whitespace-nowrap shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Auto-Apply Standard Pattern
                  </button>
                </div>
              </div>

              {/* Roster Dates Availability Grid */}
              <div className={`p-6 rounded-3xl border transition space-y-6 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"}`}>
                <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Daily Roster Schedule</h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rosterDatesList.map((dStr) => {
                    const currentVal = myDateAvailabilities[dStr] || {
                      type: "NOT_UPDATED",
                      availableFrom: "09:00",
                      availableUntil: "17:00",
                      notes: "",
                    };

                    return (
                      <div
                        key={dStr}
                        className={`p-4 rounded-2xl border transition space-y-3 ${currentVal.type === "NOT_UPDATED"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : isDark
                            ? "bg-[#0A0C12] border-white/[0.08]"
                            : "bg-slate-50 border-slate-200"
                          }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {new Date(dStr).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                          </span>

                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${currentVal.type === "AVAILABLE"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : currentVal.type === "NOT_AVAILABLE"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : currentVal.type === "SPECIFIC_TIME"
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                : currentVal.type === "LEAVE"
                                  ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            }`}>
                            {currentVal.type === "NOT_UPDATED" ? "Not Updated" : currentVal.type.replace("_", " ")}
                          </span>
                        </div>

                        {/* Availability Selector */}
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          {[
                            { key: "AVAILABLE", label: "Available" },
                            { key: "NOT_AVAILABLE", label: "Not Available" },
                            { key: "SPECIFIC_TIME", label: "Specific Time" },
                            { key: "LEAVE", label: "Leave" },
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={isAvailabilityLocked || actionLoading}
                              onClick={() => {
                                if (isAvailabilityLocked) return;
                                setMyDateAvailabilities((prev) => ({
                                  ...prev,
                                  [dStr]: {
                                    ...currentVal,
                                    type: opt.key as any,
                                  },
                                }));
                              }}
                              className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition ${
                                isAvailabilityLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                              } ${currentVal.type === opt.key
                                ? "bg-[#0071E3] border-[#0071E3] text-white"
                                : isDark
                                  ? "bg-white/5 border-white/10 text-[#8F95A3] hover:text-white"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Specific Time Inputs */}
                        {currentVal.type === "SPECIFIC_TIME" && (
                          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                            <div>
                              <label className={`block text-[10px] font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>From</label>
                              <input
                                type="time"
                                disabled={isAvailabilityLocked || actionLoading}
                                value={currentVal.availableFrom || "09:00"}
                                onChange={(e) => {
                                  if (isAvailabilityLocked) return;
                                  setMyDateAvailabilities((prev) => ({
                                    ...prev,
                                    [dStr]: { ...currentVal, availableFrom: e.target.value },
                                  }));
                                }}
                                className={`w-full px-2 py-1 rounded-lg border text-xs ${isAvailabilityLocked ? "opacity-60 cursor-not-allowed" : ""} ${isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200"}`}
                              />
                            </div>
                            <div>
                              <label className={`block text-[10px] font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Until</label>
                              <input
                                type="time"
                                disabled={isAvailabilityLocked || actionLoading}
                                value={currentVal.availableUntil || "17:00"}
                                onChange={(e) => {
                                  if (isAvailabilityLocked) return;
                                  setMyDateAvailabilities((prev) => ({
                                    ...prev,
                                    [dStr]: { ...currentVal, availableUntil: e.target.value },
                                  }));
                                }}
                                className={`w-full px-2 py-1 rounded-lg border text-xs ${isAvailabilityLocked ? "opacity-60 cursor-not-allowed" : ""} ${isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200"}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Save & Submit Availability Actions */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/[0.06] w-full">
                  <button
                    onClick={handleSaveEmployeeAvailability}
                    disabled={isAvailabilityLocked || actionLoading}
                    className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 text-xs font-semibold rounded-xl border transition cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"}`}
                  >
                    Save Draft
                  </button>

                  <button
                    onClick={() => setSubmitConfirmModalOpen(true)}
                    disabled={isAvailabilityLocked || actionLoading}
                    className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Availability
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* CREATE ROSTER PERIOD MODAL */}
        {newRosterModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold tracking-tight">Create Roster Period</h2>
                <button onClick={() => setNewRosterModalOpen(false)} className="text-slate-400 hover:text-white text-base cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreateRoster} className="space-y-4 text-xs">
                {outlets.length > 0 && (
                  <div>
                    <label className={`block font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>Outlet *</label>
                    <select
                      value={rosterOutlet || selectedOutlet || outlets[0]?.id || ""}
                      onChange={(e) => setRosterOutlet(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className={`block font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>Roster Period Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. August 24 – August 30 Roster"
                    value={rosterName}
                    onChange={(e) => setRosterName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>Start Date *</label>
                    <input
                      type="date"
                      required
                      value={rosterStart}
                      onChange={(e) => setRosterStart(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                    />
                  </div>
                  <div>
                    <label className={`block font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>End Date *</label>
                    <input
                      type="date"
                      required
                      value={rosterEnd}
                      onChange={(e) => setRosterEnd(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>Availability Submission Deadline</label>
                  <input
                    type="datetime-local"
                    value={rosterDeadline}
                    onChange={(e) => setRosterDeadline(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button type="button" onClick={() => setNewRosterModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                  <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl cursor-pointer">
                    {actionLoading ? "Creating..." : "Create Roster Period"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ASSIGN SHIFT MODAL WITH SMART SUGGESTIONS & FAIR DISTRIBUTION (Requirement 8, 9, 10, 11) */}
        {assignModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Assign Shift with Smart Suggestions</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Shift assignments automatically validate availability & fair hour limits.</p>
                </div>
                <button onClick={() => { setAssignModalOpen(false); setModalError(null); }} className="text-slate-400 hover:text-white text-base cursor-pointer">✕</button>
              </div>

              {modalError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="leading-relaxed">{modalError}</span>
                    <button type="button" onClick={() => setModalError(null)} className="font-bold text-rose-400 hover:text-rose-300 cursor-pointer">✕</button>
                  </div>
                  {modalError.includes("Weekly working hours limit exceeded") && (
                    <div className="pt-2 border-t border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-rose-400 font-medium">Allow admin override to schedule these extra hours?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideHoursLimit(true);
                          setModalError(null);
                          handleAssignShift(undefined, true);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        Override & Assign Shift
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={(e) => handleAssignShift(e)} className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Shift Date *</label>
                    <input
                      type="date"
                      required
                      value={assignDate}
                      onChange={(e) => setAssignDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={assignStartTime}
                      onChange={(e) => setAssignStartTime(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">End Time *</label>
                    <input
                      type="time"
                      required
                      value={assignEndTime}
                      onChange={(e) => setAssignEndTime(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                    />
                  </div>
                </div>

                {/* Smart Staff Suggestions Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#0071E3]">
                      Smart Staff Suggestions & Fair Hour Distribution
                    </h3>
                    <div className="flex items-center gap-2">
                      {smartSuggestions.recommended.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployeesForShift(smartSuggestions.recommended.map((e) => e.employeeId));
                            setAssignOverrideWarning(null);
                          }}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>Select All Recommended ({smartSuggestions.recommended.length})</span>
                        </button>
                      )}
                      {selectedEmployeesForShift.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeesForShift([])}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>

                  {loadingSuggestions ? (
                    <div className="text-center py-6">
                      <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-[11px] text-slate-400">Analyzing availability & weekly hours...</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                      {/* Recommended (Fully Available + Fairly Distributed) */}
                      <div>
                        <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                          <span>Recommended Employees (Fair Hours First)</span>
                        </h4>
                        {smartSuggestions.recommended.length === 0 ? (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            No fully available employees found for this shift window.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {smartSuggestions.recommended.map((emp) => {
                              const isSelected = selectedEmployeesForShift.includes(emp.employeeId);
                              return (
                                <label
                                  key={emp.employeeId}
                                  onClick={() => {
                                    setSelectedEmployeesForShift((prev) =>
                                      prev.includes(emp.employeeId)
                                        ? prev.filter((id) => id !== emp.employeeId)
                                        : [...prev, emp.employeeId]
                                    );
                                    setAssignOverrideWarning(null);
                                  }}
                                  className={`p-3 rounded-xl border-2 cursor-pointer transition flex justify-between items-center ${isSelected
                                    ? "bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-white shadow-sm ring-1 ring-emerald-500/50"
                                    : isDark
                                      ? "bg-[#0A0C12] border-white/10 hover:border-white/20 text-slate-200"
                                      : "bg-white border-slate-200 hover:bg-emerald-50/50 text-slate-800"
                                    }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => { }}
                                        className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 pointer-events-none"
                                      />
                                      <span className="font-bold text-xs truncate">{emp.name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 ml-5">
                                      {emp.departmentName} • {emp.designationName}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                      {emp.weeklyHoursAssigned.toFixed(1)}h / {emp.maxWeeklyHours}h
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Partially Available */}
                      {smartSuggestions.partiallyAvailable.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                            <span>Partially Available / Not Updated</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {smartSuggestions.partiallyAvailable.map((emp) => {
                              const isSelected = selectedEmployeesForShift.includes(emp.employeeId);
                              return (
                                <label
                                  key={emp.employeeId}
                                  onClick={() => {
                                    setSelectedEmployeesForShift((prev) =>
                                      prev.includes(emp.employeeId)
                                        ? prev.filter((id) => id !== emp.employeeId)
                                        : [...prev, emp.employeeId]
                                    );
                                    setAssignOverrideWarning(emp.reason || "Partial Availability Conflict");
                                  }}
                                  className={`p-3 rounded-xl border-2 cursor-pointer transition flex justify-between items-center ${isSelected
                                    ? "bg-amber-500/15 border-amber-500 text-slate-900 dark:text-white shadow-sm ring-1 ring-amber-500/50"
                                    : isDark
                                      ? "bg-[#0A0C12] border-amber-500/20 text-slate-200"
                                      : "bg-amber-50/60 border-amber-200 text-slate-800"
                                    }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => { }}
                                        className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 pointer-events-none"
                                      />
                                      <span className="font-bold text-xs truncate">{emp.name}</span>
                                    </div>
                                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium block mt-0.5 ml-5">
                                      {emp.reason || "Availability not explicitly updated yet."}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Unavailable / On Leave */}
                      {smartSuggestions.unavailable.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                            <span>Unavailable / Leave / Conflict</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {smartSuggestions.unavailable.map((emp) => (
                              <div
                                key={emp.employeeId}
                                className={`p-3 rounded-xl border opacity-75 ${isDark ? "bg-rose-500/10 border-rose-500/20 text-slate-300" : "bg-rose-50 border-rose-200 text-slate-800"}`}
                              >
                                <span className="font-bold block text-xs text-rose-700 dark:text-rose-300 truncate">{emp.name}</span>
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">{emp.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin Override Toggle */}
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${overrideHoursLimit ? "bg-amber-500/10 border-amber-500/30" : isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}>
                  <div>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Override Working Hours Limit</span>
                    <span className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Allow scheduling beyond the employee's weekly contract or part-time hour limit.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={overrideHoursLimit}
                    onChange={(e) => setOverrideHoursLimit(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0071E3] focus:ring-[#0071E3] accent-[#0071E3] cursor-pointer"
                  />
                </div>

                {assignOverrideWarning && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-medium rounded-xl flex items-center gap-2">
                    <span><strong>Admin Override Notice:</strong> {assignOverrideWarning}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button type="button" onClick={() => { setAssignModalOpen(false); setModalError(null); }} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                  <button type="submit" disabled={actionLoading || selectedEmployeesForShift.length === 0} className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2">
                    {actionLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Assigning Shifts...</span>
                      </>
                    ) : (
                      `Confirm & Assign Shift (${selectedEmployeesForShift.length} ${selectedEmployeesForShift.length === 1 ? "Employee" : "Employees"})`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBMIT AVAILABILITY CONFIRMATION MODAL (Requirement 6) */}
        {submitConfirmModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <h3 className="text-base font-bold tracking-tight">Submit Schedule Availability</h3>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Please review your availability before submitting. Once submitted, changes may require admin approval after the deadline.
              </p>

              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center justify-between">
                  <span>{modalError}</span>
                  <button onClick={() => setModalError(null)} className="font-bold text-rose-400 cursor-pointer">✕</button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Optional Notes for Manager</label>
                <textarea
                  rows={2}
                  value={mySubmissionNotes}
                  onChange={(e) => setMySubmissionNotes(e.target.value)}
                  placeholder="e.g. Prefer morning shifts on Wednesdays..."
                  className={`w-full p-2.5 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setSubmitConfirmModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  Review Again
                </button>
                <button
                  type="button"
                  onClick={handleSubmitFinalAvailability}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    "Confirm & Submit Availability"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM CONFIRM DIALOG */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <h3 className="text-base font-bold tracking-tight">{confirmDialog.title}</h3>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>{confirmDialog.message}</p>
              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                    await confirmDialog.onConfirm();
                  }}
                  className={`px-5 py-2 text-white text-xs font-semibold rounded-xl transition cursor-pointer ${confirmDialog.confirmVariant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmDialog.confirmVariant === "warning"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-[#0071E3] hover:bg-[#0077ED]"
                    }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-semibold backdrop-blur-xl ${
                toastMessage.type === "success"
                  ? isDark
                    ? "bg-[#121622]/95 border-emerald-500/30 text-emerald-400 shadow-emerald-950/40"
                    : "bg-white/95 border-emerald-300 text-emerald-700 shadow-emerald-100"
                  : isDark
                    ? "bg-[#121622]/95 border-rose-500/30 text-rose-400 shadow-rose-950/40"
                    : "bg-white/95 border-rose-300 text-rose-700 shadow-rose-100"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${toastMessage.type === "success" ? "bg-emerald-500" : "bg-rose-500"} animate-pulse`} />
              <span>{toastMessage.message}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 text-slate-400 hover:text-slate-200 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
