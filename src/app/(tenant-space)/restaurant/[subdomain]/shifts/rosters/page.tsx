"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import SearchableCombobox from "@/components/SearchableCombobox";
import {
  ArrowLeft,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Moon,
  Clock,
  Send,
  X,
  Users,
  MapPin,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  timezone: string;
  workweekStartDay?: number;
  hardWeeklyHoursCap?: number;
  allowOvertimeOverride?: boolean;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
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
  templateId?: string | null;
  employeeId: string;
  outletId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  roleName?: string | null;
  notes?: string | null;
  status: string;
  employee?: Employee;
  template?: ShiftTemplate | null;
  outlet?: { id: string; name: string; timezone?: string };
  isDraftPending?: boolean;
}

interface ShiftRoster {
  id: string;
  name: string;
  outletId: string;
  startDate: string;
  endDate: string;
  availabilityDeadline?: string | null;
  status:
    | "DRAFT"
    | "AVAILABILITY_OPEN"
    | "AVAILABILITY_LOCKED"
    | "ASSIGNMENT_IN_PROGRESS"
    | "PUBLISHED"
    | "COMPLETED"
    | "ARCHIVED";
  version: number;
  draftRevisionJson?: {
    adds: any[];
    updates: any[];
    deletes: string[];
  } | null;
  outlet?: Outlet;
}

interface SuggestionItem {
  employeeId: string;
  name: string;
  employeeCode: string;
  departmentName: string;
  designationName: string;
  weeklyHoursAssigned: number;
  weeklyShiftCount: number;
  maxWeeklyHours: number;
  remainingWeeklyHours: number;
  availabilityType: "AVAILABLE" | "NOT_AVAILABLE" | "SPECIFIC_TIME" | "LEAVE" | "NOT_UPDATED";
  availableFrom?: string | null;
  availableUntil?: string | null;
  reason?: string;
}

const STATUS_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" },
  AVAILABILITY_OPEN: { label: "Collecting Availability", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  AVAILABILITY_LOCKED: { label: "Availability Locked", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  ASSIGNMENT_IN_PROGRESS: { label: "Scheduling", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  PUBLISHED: { label: "Published", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  COMPLETED: { label: "Completed", cls: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  ARCHIVED: { label: "Archived", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

const AVAIL_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: "Available", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  SPECIFIC_TIME: { label: "Available at specific times", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
  NOT_AVAILABLE: { label: "Unavailable", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  LEAVE: { label: "Approved leave", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  NOT_UPDATED: { label: "Not submitted", cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20" },
};

function calcPaidHours(start: string, end: string, breakMins: number): { hours: number; isOvernight: boolean } {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const isOvernight = end <= start;
  let gross = eh * 60 + em - (sh * 60 + sm);
  if (gross <= 0) gross += 24 * 60;
  const paid = Math.max(0, gross - (breakMins || 0));
  return { hours: Math.round((paid / 60) * 100) / 100, isOvernight };
}

function getPolicyCap(emp: Employee): number {
  if (emp.weeklyHoursLimit && emp.weeklyHoursLimit > 0) return emp.weeklyHoursLimit;
  if (emp.workerType === "PART_TIME" || emp.workerType === "INTERN") return 20;
  if (emp.workerType === "TEMPORARY") return 25;
  if (emp.workerType === "CONTRACT") return 40;
  return 48;
}

export default function ShiftRostersWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [rosters, setRosters] = useState<ShiftRoster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [availabilityData, setAvailabilityData] = useState<any>(null);
  const [canManageRoster, setCanManageRoster] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [rosterPickerOpen, setRosterPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Week pagination (for bi-weekly rosters) + Mobile selected day
  const [weekIndex, setWeekIndex] = useState(0);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<string>("");

  // Create Roster Modal
  const [createRosterOpen, setCreateRosterOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState("");
  const [newRosterStart, setNewRosterStart] = useState("");
  const [newRosterEnd, setNewRosterEnd] = useState("");
  const [newRosterDeadline, setNewRosterDeadline] = useState("");
  const [creatingRoster, setCreatingRoster] = useState(false);

  // Assignment Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ShiftAssignment | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formShiftDate, setFormShiftDate] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formBreakMinutes, setFormBreakMinutes] = useState(30);
  const [formRoleName, setFormRoleName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formOverrideHours, setFormOverrideHours] = useState(false);
  const [formOverrideReason, setFormOverrideReason] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<{
    recommended: SuggestionItem[];
    partiallyAvailable: SuggestionItem[];
    unavailable: SuggestionItem[];
  } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Review & Publish Modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Drag & Drop state
  const [draggedShift, setDraggedShift] = useState<ShiftAssignment | null>(null);

  const selectedOutlet = useMemo(
    () => outlets.find((o) => o.id === selectedOutletId) || outlets[0] || null,
    [outlets, selectedOutletId]
  );

  const selectedRoster = useMemo(
    () => rosters.find((r) => r.id === selectedRosterId) || null,
    [rosters, selectedRosterId]
  );

  // Load initial outlets, rosters, employees, templates
  const loadBaseData = async (preferredOutletId?: string, preferredRosterId?: string) => {
    try {
      const [resOutlets, resRosters, resEmps, resTpls] = await Promise.all([
        fetch("/api/restaurant/outlets"),
        fetch("/api/restaurant/shifts/rosters"),
        fetch("/api/restaurant/employees/roster-eligible"),
        fetch("/api/restaurant/shifts/templates"),
      ]);

      let outletList: Outlet[] = [];
      if (resOutlets.ok) {
        const d = await resOutlets.json();
        outletList = d.outlets || [];
        setOutlets(outletList);
      }

      const targetOutletId =
        preferredOutletId ||
        searchParams.get("outletId") ||
        selectedOutletId ||
        outletList[0]?.id ||
        "";
      if (targetOutletId) setSelectedOutletId(targetOutletId);

      if (resRosters.ok) {
        const d = await resRosters.json();
        const rosterList: ShiftRoster[] = d.rosters || [];
        setRosters(rosterList);
        if (d.permissions) {
          setCanManageRoster(Boolean(d.permissions.canManageRoster));
        } else {
          setCanManageRoster(false);
        }

        const urlRosterId = preferredRosterId || searchParams.get("rosterId");
        if (urlRosterId && rosterList.some((r) => r.id === urlRosterId)) {
          setSelectedRosterId(urlRosterId);
        } else {
          const matching = rosterList.filter((r) => !targetOutletId || r.outletId === targetOutletId);
          if (matching.length > 0 && (!selectedRosterId || !matching.some((m) => m.id === selectedRosterId))) {
            setSelectedRosterId(matching[0].id);
          }
        }
      }

      if (resEmps.ok) {
        const d = await resEmps.json();
        setEmployees(d.employees || []);
      }

      if (resTpls.ok) {
        const d = await resTpls.json();
        setTemplates(d.templates || []);
      }
    } finally {
      setPermissionsLoaded(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
    if (searchParams.get("create") === "1") {
      setCreateRosterOpen(true);
    }
  }, []);

  // Load roster assignments & availability whenever selectedRosterId changes
  const loadRosterDetails = async (rosterId: string) => {
    if (!rosterId) return;
    const [resAssign, resAvail] = await Promise.all([
      fetch(`/api/restaurant/shifts/assignments?rosterId=${rosterId}`),
      fetch(`/api/restaurant/shifts/rosters/${rosterId}/availability`),
    ]);

    if (resAssign.ok) {
      const d = await resAssign.json();
      setAssignments(d.assignments || []);
    }
    if (resAvail.ok) {
      const d = await resAvail.json();
      setAvailabilityData(d);
      if (d?.availabilities?.length > 0) {
        setEmployees((prev) => {
          if (prev.length > 0) return prev;
          return d.availabilities.map((a: any) => ({
            id: a.employee.id,
            firstName: a.employee.firstName,
            lastName: a.employee.lastName,
            employeeCode: a.employee.employeeCode,
            employmentRecords: [
              {
                department: { id: a.employee.departmentId || "gen", name: a.employee.department || "General" },
                designation: { id: "desig", name: a.employee.designation || "Staff" },
              },
            ],
          }));
        });
      }
    }
  };

  useEffect(() => {
    if (selectedRosterId) {
      loadRosterDetails(selectedRosterId);
      setWeekIndex(0);
    } else {
      setAssignments([]);
      setAvailabilityData(null);
    }
  }, [selectedRosterId]);

  useEffect(() => {
    if (searchParams.get("review") === "1" && selectedRosterId) {
      openReviewModal();
    }
  }, [selectedRosterId]);

  // All dates in selected roster
  const rosterDates = useMemo(() => {
    if (!selectedRoster) return [];
    const startStr = selectedRoster.startDate.slice(0, 10);
    const endStr = selectedRoster.endDate.slice(0, 10);
    const list: string[] = [];
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    const curr = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    while (curr <= end) {
      list.push(curr.toISOString().slice(0, 10));
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return list;
  }, [selectedRoster]);

  const totalWeeks = Math.max(1, Math.ceil(rosterDates.length / 7));
  const visibleDates = useMemo(() => {
    const start = weekIndex * 7;
    return rosterDates.slice(start, start + 7);
  }, [rosterDates, weekIndex]);

  useEffect(() => {
    if (visibleDates.length > 0 && (!mobileSelectedDate || !visibleDates.includes(mobileSelectedDate))) {
      setMobileSelectedDate(visibleDates[0]);
    }
  }, [visibleDates]);

  // Merge live assignments with pending draftRevisionJson when editing a PUBLISHED roster
  const effectiveAssignments = useMemo(() => {
    if (!selectedRoster || selectedRoster.status !== "PUBLISHED" || !selectedRoster.draftRevisionJson) {
      return assignments;
    }
    const rev = selectedRoster.draftRevisionJson;
    const delSet = new Set(rev.deletes || []);
    const updMap = new Map((rev.updates || []).map((u) => [u.targetAssignmentId || u.draftId, u]));

    const merged: ShiftAssignment[] = [];
    for (const a of assignments) {
      if (delSet.has(a.id)) continue;
      if (updMap.has(a.id)) {
        const u = updMap.get(a.id);
        merged.push({
          ...a,
          employeeId: u.employeeId,
          shiftDate: `${u.shiftDate}T00:00:00.000Z`,
          startTime: u.startTime,
          endTime: u.endTime,
          breakMinutes: u.breakMinutes,
          roleName: u.roleName,
          notes: u.notes,
          templateId: u.templateId,
          isDraftPending: true,
        });
      } else {
        merged.push(a);
      }
    }

    for (const add of rev.adds || []) {
      const emp = employees.find((e) => e.id === add.employeeId);
      const tpl = templates.find((t) => t.id === add.templateId);
      merged.push({
        id: add.draftId,
        rosterId: selectedRoster.id,
        templateId: add.templateId,
        employeeId: add.employeeId,
        outletId: add.outletId,
        shiftDate: `${add.shiftDate}T00:00:00.000Z`,
        startTime: add.startTime,
        endTime: add.endTime,
        breakMinutes: add.breakMinutes,
        roleName: add.roleName,
        notes: add.notes,
        status: "SCHEDULED",
        employee: emp,
        template: tpl || null,
        isDraftPending: true,
      });
    }

    return merged;
  }, [assignments, selectedRoster, employees, templates]);

  const pendingRevisionCount = useMemo(() => {
    const rev = selectedRoster?.draftRevisionJson;
    if (!rev) return 0;
    return (rev.adds?.length || 0) + (rev.updates?.length || 0) + (rev.deletes?.length || 0);
  }, [selectedRoster]);

  // Group employees by department
  const departmentGroups = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const emp of employees) {
      const dept = emp.employmentRecords?.[0]?.department?.name || "General";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(emp);
    }
    return Array.from(map.entries()).map(([department, staff]) => ({ department, staff }));
  }, [employees]);

  // Calculate visible week hours per employee
  const employeeVisibleWeekHours = useMemo(() => {
    const map = new Map<string, number>();
    const visibleSet = new Set(visibleDates);
    for (const a of effectiveAssignments) {
      if (a.status === "CANCELLED") continue;
      const dKey = a.shiftDate.slice(0, 10);
      if (!visibleSet.has(dKey)) continue;
      const dur = calcPaidHours(a.startTime, a.endTime, a.breakMinutes);
      map.set(a.employeeId, Math.round(((map.get(a.employeeId) || 0) + dur.hours) * 100) / 100);
    }
    return map;
  }, [effectiveAssignments, visibleDates]);

  const getAvailabilityForCell = (employeeId: string, dateKey: string) => {
    const empAvail = availabilityData?.availabilities?.find((a: any) => a.employee?.id === employeeId);
    return empAvail?.days?.[dateKey] || { type: "NOT_UPDATED", label: "Not submitted" };
  };

  // Fetch smart suggestions when editor is open
  useEffect(() => {
    if (!editorOpen || !selectedRosterId || !formShiftDate) return;
    setLoadingSuggestions(true);
    fetch(
      `/api/restaurant/shifts/rosters/${selectedRosterId}/suggestions?shiftDate=${formShiftDate}&startTime=${formStartTime}&endTime=${formEndTime}&breakMinutes=${formBreakMinutes}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setSuggestions(d);
      })
      .finally(() => setLoadingSuggestions(false));
  }, [editorOpen, selectedRosterId, formShiftDate, formStartTime, formEndTime, formBreakMinutes]);

  const openCreateAssignmentModal = (employeeId: string, dateKey: string) => {
    if (!canManageRoster || !selectedRoster) return;
    setEditingAssignment(null);
    setFormEmployeeId(employeeId);
    setFormShiftDate(dateKey);
    const defaultTpl = templates[0];
    setFormTemplateId(defaultTpl?.id || "");
    setFormStartTime(defaultTpl?.startTime || "09:00");
    setFormEndTime(defaultTpl?.endTime || "17:00");
    setFormBreakMinutes(defaultTpl?.breakMinutes ?? 30);
    const emp = employees.find((e) => e.id === employeeId);
    setFormRoleName(emp?.employmentRecords?.[0]?.designation?.name || "");
    setFormNotes("");
    setFormOverrideHours(false);
    setFormOverrideReason("");
    setEditorError(null);
    setEditorOpen(true);
  };

  const openEditAssignmentModal = (a: ShiftAssignment) => {
    if (!canManageRoster) return;
    setEditingAssignment(a);
    setFormEmployeeId(a.employeeId);
    setFormShiftDate(a.shiftDate.slice(0, 10));
    setFormTemplateId(a.templateId || "");
    setFormStartTime(a.startTime);
    setFormEndTime(a.endTime);
    setFormBreakMinutes(a.breakMinutes ?? 0);
    setFormRoleName(a.roleName || a.employee?.employmentRecords?.[0]?.designation?.name || "");
    setFormNotes(a.notes || "");
    setFormOverrideHours(false);
    setFormOverrideReason("");
    setEditorError(null);
    setEditorOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoster || !formEmployeeId || !formShiftDate) return;
    setSavingAssignment(true);
    setEditorError(null);

    try {
      if (selectedRoster.status === "PUBLISHED") {
        // Save into draftRevisionJson so live staff & attendance stay untouched until Publish Revision!
        const currentRev = selectedRoster.draftRevisionJson || { adds: [], updates: [], deletes: [] };
        const nextRev = {
          adds: [...(currentRev.adds || [])],
          updates: [...(currentRev.updates || [])],
          deletes: [...(currentRev.deletes || [])],
        };

        if (editingAssignment) {
          if (editingAssignment.id.startsWith("draft-")) {
            nextRev.adds = nextRev.adds.map((item) =>
              item.draftId === editingAssignment.id
                ? {
                    ...item,
                    employeeId: formEmployeeId,
                    templateId: formTemplateId || null,
                    shiftDate: formShiftDate,
                    startTime: formStartTime,
                    endTime: formEndTime,
                    breakMinutes: Number(formBreakMinutes),
                    roleName: formRoleName || null,
                    notes: formNotes || null,
                    overrideHoursLimit: formOverrideHours,
                    overrideReason: formOverrideReason || null,
                  }
                : item
            );
          } else {
            nextRev.updates = nextRev.updates.filter(
              (u) => (u.targetAssignmentId || u.draftId) !== editingAssignment.id
            );
            nextRev.updates.push({
              draftId: editingAssignment.id,
              targetAssignmentId: editingAssignment.id,
              action: "UPDATE",
              employeeId: formEmployeeId,
              outletId: selectedRoster.outletId,
              templateId: formTemplateId || null,
              shiftDate: formShiftDate,
              startTime: formStartTime,
              endTime: formEndTime,
              breakMinutes: Number(formBreakMinutes),
              roleName: formRoleName || null,
              notes: formNotes || null,
              overrideHoursLimit: formOverrideHours,
              overrideReason: formOverrideReason || null,
            });
          }
        } else {
          nextRev.adds.push({
            draftId: `draft-${Date.now()}`,
            action: "ADD",
            employeeId: formEmployeeId,
            outletId: selectedRoster.outletId,
            templateId: formTemplateId || null,
            shiftDate: formShiftDate,
            startTime: formStartTime,
            endTime: formEndTime,
            breakMinutes: Number(formBreakMinutes),
            roleName: formRoleName || null,
            notes: formNotes || null,
            overrideHoursLimit: formOverrideHours,
            overrideReason: formOverrideReason || null,
          });
        }

        const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRoster.id}/review`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: selectedRoster.version, ...nextRev }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to save revision");

        setEditorOpen(false);
        setBannerSuccess("Saved to draft revision. Click Review & Publish to make changes live.");
        await loadBaseData(selectedOutletId, selectedRoster.id);
      } else {
        // Direct edit on non-published roster
        const url = "/api/restaurant/shifts/assignments";
        const method = editingAssignment ? "PATCH" : "POST";
        const payload = editingAssignment
          ? {
              id: editingAssignment.id,
              employeeId: formEmployeeId,
              templateId: formTemplateId || null,
              shiftDate: formShiftDate,
              startTime: formStartTime,
              endTime: formEndTime,
              breakMinutes: Number(formBreakMinutes),
              roleName: formRoleName || null,
              notes: formNotes || null,
              overrideHoursLimit: formOverrideHours,
              overrideReason: formOverrideReason || undefined,
              expectedVersion: selectedRoster.version,
            }
          : {
              rosterId: selectedRoster.id,
              outletId: selectedRoster.outletId,
              employeeId: formEmployeeId,
              templateId: formTemplateId || undefined,
              shiftDate: formShiftDate,
              startTime: formStartTime,
              endTime: formEndTime,
              breakMinutes: Number(formBreakMinutes),
              roleName: formRoleName || null,
              notes: formNotes || undefined,
              overrideHoursLimit: formOverrideHours,
              overrideReason: formOverrideReason || undefined,
              expectedVersion: selectedRoster.version,
            };

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Validation failed");

        setEditorOpen(false);
        await Promise.all([loadBaseData(selectedOutletId, selectedRoster.id), loadRosterDetails(selectedRoster.id)]);
      }
    } catch (err: any) {
      setEditorError(err.message);
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!editingAssignment || !selectedRoster) return;
    setSavingAssignment(true);
    setEditorError(null);
    try {
      if (selectedRoster.status === "PUBLISHED") {
        const currentRev = selectedRoster.draftRevisionJson || { adds: [], updates: [], deletes: [] };
        const nextRev = {
          adds: (currentRev.adds || []).filter((a) => a.draftId !== editingAssignment.id),
          updates: (currentRev.updates || []).filter(
            (u) => (u.targetAssignmentId || u.draftId) !== editingAssignment.id
          ),
          deletes: editingAssignment.id.startsWith("draft-")
            ? currentRev.deletes || []
            : Array.from(new Set([...(currentRev.deletes || []), editingAssignment.id])),
        };
        const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRoster.id}/review`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: selectedRoster.version, ...nextRev }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to stage removal");
        setEditorOpen(false);
        await loadBaseData(selectedOutletId, selectedRoster.id);
      } else {
        const res = await fetch(`/api/restaurant/shifts/assignments?id=${editingAssignment.id}`, {
          method: "DELETE",
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to remove shift");
        setEditorOpen(false);
        await Promise.all([loadBaseData(selectedOutletId, selectedRoster.id), loadRosterDetails(selectedRoster.id)]);
      }
    } catch (err: any) {
      setEditorError(err.message);
    } finally {
      setSavingAssignment(false);
    }
  };

  // Drag and drop handler with validation surfacing
  const handleDropOnCell = async (targetEmpId: string, targetDateKey: string) => {
    if (!draggedShift || !selectedRoster || !canManageRoster) return;
    setBannerError(null);
    setBannerSuccess(null);

    if (draggedShift.employeeId === targetEmpId && draggedShift.shiftDate.slice(0, 10) === targetDateKey) {
      setDraggedShift(null);
      return;
    }

    try {
      if (selectedRoster.status === "PUBLISHED") {
        const currentRev = selectedRoster.draftRevisionJson || { adds: [], updates: [], deletes: [] };
        const nextRev = {
          adds: [...(currentRev.adds || [])],
          updates: [...(currentRev.updates || []).filter((u) => (u.targetAssignmentId || u.draftId) !== draggedShift.id)],
          deletes: [...(currentRev.deletes || [])],
        };
        nextRev.updates.push({
          draftId: draggedShift.id,
          targetAssignmentId: draggedShift.id,
          action: "UPDATE",
          employeeId: targetEmpId,
          outletId: selectedRoster.outletId,
          templateId: draggedShift.templateId || null,
          shiftDate: targetDateKey,
          startTime: draggedShift.startTime,
          endTime: draggedShift.endTime,
          breakMinutes: draggedShift.breakMinutes,
          roleName: draggedShift.roleName || null,
          notes: draggedShift.notes || null,
        });
        const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRoster.id}/review`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: selectedRoster.version, ...nextRev }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to move shift in revision");
        await loadBaseData(selectedOutletId, selectedRoster.id);
      } else {
        const res = await fetch("/api/restaurant/shifts/assignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draggedShift.id,
            employeeId: targetEmpId,
            shiftDate: targetDateKey,
            expectedVersion: selectedRoster.version,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Cannot move shift here");
        await Promise.all([loadBaseData(selectedOutletId, selectedRoster.id), loadRosterDetails(selectedRoster.id)]);
      }
    } catch (err: any) {
      setBannerError(err.message);
    } finally {
      setDraggedShift(null);
    }
  };

  // Lifecycle transition
  const handleStatusTransition = async (nextStatus: string) => {
    if (!selectedRoster) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRoster.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, expectedVersion: selectedRoster.version }),
    });
    const d = await res.json();
    if (!res.ok) {
      setBannerError(d.error || "Failed to transition roster status");
      return;
    }
    setBannerSuccess(`Roster moved to ${STATUS_BADGE_MAP[nextStatus]?.label || nextStatus}.`);
    await loadBaseData(selectedOutletId, selectedRoster.id);
  };

  const openReviewModal = async () => {
    if (!selectedRoster) return;
    setReviewOpen(true);
    setLoadingReview(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRoster.id}/review`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load review");
      setReviewData(d);
    } catch (err: any) {
      setBannerError(err.message);
    } finally {
      setLoadingReview(false);
    }
  };

  const handlePublishRoster = async () => {
    if (!selectedRoster) return;
    setPublishing(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/restaurant/shifts/rosters/${selectedRoster.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: selectedRoster.version }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Publish failed");
      setReviewOpen(false);
      setBannerSuccess("Roster published atomically and affected staff notified.");
      await Promise.all([loadBaseData(selectedOutletId, selectedRoster.id), loadRosterDetails(selectedRoster.id)]);
    } catch (err: any) {
      setBannerError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId) return;
    setCreatingRoster(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/restaurant/shifts/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutletId,
          name: newRosterName,
          startDate: newRosterStart,
          endDate: newRosterEnd,
          availabilityDeadline: newRosterDeadline || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create roster");
      setCreateRosterOpen(false);
      setNewRosterName("");
      await loadBaseData(selectedOutletId, d.roster.id);
    } catch (err: any) {
      setBannerError(err.message);
    } finally {
      setCreatingRoster(false);
    }
  };

  const nextLifecycleAction = useMemo(() => {
    if (!selectedRoster || !canManageRoster) return null;
    switch (selectedRoster.status) {
      case "DRAFT":
        return { label: "Open Availability", nextStatus: "AVAILABILITY_OPEN", secondary: { label: "Skip to Scheduling", nextStatus: "ASSIGNMENT_IN_PROGRESS" } };
      case "AVAILABILITY_OPEN":
        return { label: "Lock Availability", nextStatus: "AVAILABILITY_LOCKED" };
      case "AVAILABILITY_LOCKED":
        return { label: "Start Scheduling", nextStatus: "ASSIGNMENT_IN_PROGRESS" };
      case "ASSIGNMENT_IN_PROGRESS":
        return null; // Primary action is Review & Publish
      case "PUBLISHED":
        return { label: "Mark Completed", nextStatus: "COMPLETED" };
      default:
        return null;
    }
  }, [selectedRoster, canManageRoster]);

  const outletRosters = rosters.filter((r) => !selectedOutletId || r.outletId === selectedOutletId);

  useEffect(() => {
    if (permissionsLoaded && !canManageRoster && subdomain) {
      router.replace(`/restaurant/${subdomain}/shifts/my-shifts`);
    }
  }, [permissionsLoaded, canManageRoster, router, subdomain]);

  if (permissionsLoaded && !canManageRoster) {
    return (
      <ModuleAccessGuard moduleKey="shifts" moduleName="Shifts & Rosters">
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#F5F5F7] dark:bg-[#090B10] text-slate-900 dark:text-white">
          <div className="max-w-sm w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121622] p-6 text-center space-y-3">
            <h1 className="text-base font-bold">Manager Access Required</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Roster management is restricted to authorized managers. Redirecting you to My Shifts...
            </p>
            <button
              type="button"
              onClick={() => router.replace(`/restaurant/${subdomain}/shifts/my-shifts`)}
              className="w-full px-4 py-2 rounded-xl bg-[#0071E3] text-white text-xs font-semibold cursor-pointer"
            >
              Go to My Shifts
            </button>
          </div>
        </div>
      </ModuleAccessGuard>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="Roster Scheduler">
      <div
        className={`min-h-screen font-sans antialiased flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Shifts & Scheduling" />

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-6 py-4 space-y-4">
          {/* Page Title & Back Navigation */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => router.push(`/restaurant/${subdomain}/shifts`)}
                className="p-2 rounded-xl border border-black/10 dark:border-white/10 text-slate-500 hover:text-[#0071E3] cursor-pointer shrink-0"
                title="Back to Shift Operations"
                aria-label="Back to Shift Operations"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">Staff Rosters</h1>
            </div>

            {selectedRoster && (
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                  STATUS_BADGE_MAP[selectedRoster.status]?.cls || ""
                }`}
              >
                {STATUS_BADGE_MAP[selectedRoster.status]?.label || selectedRoster.status} (v{selectedRoster.version})
              </span>
            )}
          </div>

          {/* Outlet & Roster Controls */}
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col xl:flex-row xl:items-end justify-between gap-3 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 w-full xl:w-auto">
              <div className="w-full sm:w-[220px] min-w-0">
                <label
                  htmlFor="roster-outlet-select"
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Outlet
                </label>
                <select
                  id="roster-outlet-select"
                  value={selectedOutletId}
                  onChange={(e) => {
                    setSelectedOutletId(e.target.value);
                    const first = rosters.find((r) => r.outletId === e.target.value);
                    setSelectedRosterId(first?.id || "");
                    setRosterPickerOpen(false);
                  }}
                  aria-label="Outlet"
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border ${
                    isDark ? "bg-[#090B10] border-white/10 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                {selectedOutlet?.timezone && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {selectedOutlet.timezone}
                  </p>
                )}
              </div>

              {outletRosters.length > 0 && (
                <div className="w-full sm:w-[300px] min-w-0">
                  <SearchableCombobox
                    id="roster-picker"
                    label="Roster"
                    value={selectedRosterId}
                    onChange={(val) => {
                      setSelectedRosterId(val);
                      setWeekIndex(0);
                    }}
                    options={outletRosters.map((r) => ({
                      value: r.id,
                      label: `${r.name} (${r.startDate.slice(0, 10)} → ${r.endDate.slice(0, 10)})`,
                      searchText: `${r.name} ${r.startDate.slice(0, 10)} ${r.endDate.slice(0, 10)} ${r.status}`,
                    }))}
                    placeholder="Search rosters..."
                    isOpen={rosterPickerOpen}
                    onOpenChange={setRosterPickerOpen}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>

            {outletRosters.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {totalWeeks > 1 && (
                  <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] text-xs">
                    <button
                      type="button"
                      disabled={weekIndex === 0}
                      onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
                      className="p-1 rounded-lg disabled:opacity-30 cursor-pointer"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-semibold">
                      Week {weekIndex + 1} of {totalWeeks}
                    </span>
                    <button
                      type="button"
                      disabled={weekIndex >= totalWeeks - 1}
                      onClick={() => setWeekIndex((w) => Math.min(totalWeeks - 1, w + 1))}
                      className="p-1 rounded-lg disabled:opacity-30 cursor-pointer"
                      aria-label="Next week"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {canManageRoster && (
                  <button
                    type="button"
                    onClick={() => setCreateRosterOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl border border-black/10 dark:border-white/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Roster</span>
                  </button>
                )}

                {nextLifecycleAction?.secondary && (
                  <button
                    type="button"
                    onClick={() => handleStatusTransition(nextLifecycleAction.secondary!.nextStatus)}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-black/10 dark:border-white/10 cursor-pointer"
                  >
                    {nextLifecycleAction.secondary.label}
                  </button>
                )}

                {nextLifecycleAction && (
                  <button
                    type="button"
                    onClick={() => handleStatusTransition(nextLifecycleAction.nextStatus)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 cursor-pointer"
                  >
                    {nextLifecycleAction.label}
                  </button>
                )}

                {canManageRoster && selectedRoster && (
                  <button
                    type="button"
                    onClick={openReviewModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {selectedRoster.status === "PUBLISHED" ? "Review & Publish Revision" : "Review & Publish"}
                    </span>
                    {pendingRevisionCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white text-[#0071E3] font-bold">
                        {pendingRevisionCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Alerts & Revision Banner */}
          {selectedRoster?.status === "PUBLISHED" && pendingRevisionCount > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2 flex-wrap">
              <span>
                <strong>Unpublished Revision ({pendingRevisionCount} change(s)):</strong> Staff & Attendance continue seeing the live published shifts until you click <strong>Review & Publish Revision</strong>.
              </span>
              <button
                type="button"
                onClick={openReviewModal}
                className="px-3 py-1 rounded-xl bg-amber-500 text-white font-semibold cursor-pointer"
              >
                Review Changes
              </button>
            </div>
          )}

          {selectedRoster?.availabilityDeadline && (
            <div className="text-[11px] text-slate-500 px-1 flex items-center gap-2 flex-wrap">
              <Clock className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>
                Availability deadline:{" "}
                <strong>{new Date(selectedRoster.availabilityDeadline).toLocaleString()}</strong> (
                {selectedOutlet?.timezone || "UTC"})
              </span>
            </div>
          )}

          {bannerError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{bannerError}</span>
              </span>
              <button type="button" onClick={() => setBannerError(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {bannerSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bannerSuccess}</span>
              </span>
              <button type="button" onClick={() => setBannerSuccess(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!selectedRoster ? (
            loading ? (
              <div className="p-8 text-center rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-xs text-slate-400">
                Loading roster workspace...
              </div>
            ) : (
              <div
                className={`p-6 rounded-3xl border text-center space-y-3 ${
                  isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <p className="text-sm font-semibold">No rosters for this outlet yet</p>
                {canManageRoster && (
                  <button
                    type="button"
                    onClick={() => setCreateRosterOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Roster</span>
                  </button>
                )}
              </div>
            )
          ) : (
            <>
              {/* DESKTOP WEEKLY GRID */}
              <div
                className={`hidden md:block rounded-3xl border overflow-auto max-h-[70vh] ${
                  isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0F131D] border-b border-black/[0.08] dark:border-white/[0.08]">
                    <tr>
                      <th className="sticky left-0 z-30 bg-slate-50 dark:bg-[#0F131D] p-3 text-left min-w-[220px] border-r border-black/[0.06] dark:border-white/[0.06]">
                        Employee & Weekly Hours
                      </th>
                      {visibleDates.map((dKey) => {
                        const dayShifts = effectiveAssignments.filter((a) => a.shiftDate.slice(0, 10) === dKey);
                        const totalDayHours = dayShifts.reduce(
                          (acc, s) => acc + calcPaidHours(s.startTime, s.endTime, s.breakMinutes).hours,
                          0
                        );
                        return (
                          <th key={dKey} className="p-3 text-left min-w-[155px] border-r border-black/[0.04] dark:border-white/[0.04]">
                            <div className="font-bold">{dKey}</div>
                            <div className="text-[10px] font-normal text-slate-400">
                              {dayShifts.length} shift(s) · {totalDayHours.toFixed(1)}h
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {departmentGroups.map((grp) => (
                      <React.Fragment key={grp.department}>
                        <tr className="bg-black/[0.03] dark:bg-white/[0.03]">
                          <td
                            colSpan={visibleDates.length + 1}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                          >
                            {grp.department} ({grp.staff.length})
                          </td>
                        </tr>
                        {grp.staff.map((emp) => {
                          const assignedHrs = employeeVisibleWeekHours.get(emp.id) || 0;
                          const cap = getPolicyCap(emp);
                          const overCap = assignedHrs > cap;

                          return (
                            <tr key={emp.id} className="border-b border-black/[0.05] dark:border-white/[0.05]">
                              <td className="sticky left-0 z-10 bg-white dark:bg-[#121622] p-3 border-r border-black/[0.06] dark:border-white/[0.06] align-top">
                                <div className="font-bold text-xs">
                                  {emp.firstName} {emp.lastName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {emp.employmentRecords?.[0]?.designation?.name || "Staff"}
                                </div>
                                <div
                                  className={`mt-1 text-[10px] font-mono font-semibold ${
                                    overCap ? "text-amber-500" : "text-slate-500"
                                  }`}
                                >
                                  {assignedHrs.toFixed(1)}h / {cap}h cap
                                </div>
                              </td>

                              {visibleDates.map((dKey) => {
                                const cellShifts = effectiveAssignments.filter(
                                  (a) => a.employeeId === emp.id && a.shiftDate.slice(0, 10) === dKey
                                );
                                const avail = getAvailabilityForCell(emp.id, dKey);
                                const availBadge = AVAIL_BADGE_MAP[avail.type] || AVAIL_BADGE_MAP.NOT_UPDATED;

                                return (
                                  <td
                                    key={dKey}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDropOnCell(emp.id, dKey)}
                                    className="p-2 border-r border-black/[0.04] dark:border-white/[0.04] align-top min-h-[82px]"
                                  >
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <span
                                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-[115px] ${availBadge.cls}`}
                                          title={avail.label}
                                        >
                                          {avail.type === "SPECIFIC_TIME"
                                            ? `${avail.availableFrom || ""}–${avail.availableUntil || ""}`
                                            : availBadge.label}
                                        </span>
                                        {canManageRoster && (
                                          <button
                                            type="button"
                                            onClick={() => openCreateAssignmentModal(emp.id, dKey)}
                                            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-[#0071E3] hover:bg-[#0071E3]/10 cursor-pointer"
                                            aria-label={`Assign shift to ${emp.firstName} on ${dKey}`}
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>

                                      {cellShifts.map((sh) => {
                                        const dur = calcPaidHours(sh.startTime, sh.endTime, sh.breakMinutes);
                                        return (
                                          <div
                                            key={sh.id}
                                            draggable={canManageRoster}
                                            onDragStart={() => setDraggedShift(sh)}
                                            onClick={() => openEditAssignmentModal(sh)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                openEditAssignmentModal(sh);
                                              }
                                            }}
                                            className={`p-2 rounded-xl border text-left cursor-pointer transition hover:border-[#0071E3] ${
                                              sh.isDraftPending
                                                ? "border-amber-500/50 bg-amber-500/10"
                                                : isDark
                                                ? "bg-white/[0.04] border-white/[0.08]"
                                                : "bg-slate-50 border-slate-200"
                                            }`}
                                            style={{
                                              borderLeftWidth: "3px",
                                              borderLeftColor: sh.template?.color || "#0071E3",
                                            }}
                                          >
                                            <div className="font-mono font-bold text-[11px] flex items-center justify-between gap-1">
                                              <span>
                                                {sh.startTime}–{sh.endTime}
                                              </span>
                                              {dur.isOvernight && <Moon className="w-3 h-3 text-indigo-500 shrink-0" />}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">
                                              {sh.roleName || emp.employmentRecords?.[0]?.designation?.name || "Staff"} · {dur.hours}h
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE DAILY AGENDA (360px / 390px, Zero Horizontal Scroll) */}
              <div className="md:hidden space-y-4">
                {/* Date Strip */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {visibleDates.map((dKey) => {
                    const active = mobileSelectedDate === dKey;
                    const count = effectiveAssignments.filter((a) => a.shiftDate.slice(0, 10) === dKey).length;
                    return (
                      <button
                        key={dKey}
                        type="button"
                        onClick={() => setMobileSelectedDate(dKey)}
                        className={`px-3 py-2 rounded-2xl border text-xs shrink-0 transition cursor-pointer ${
                          active
                            ? "bg-[#0071E3] border-[#0071E3] text-white font-bold"
                            : isDark
                            ? "bg-[#121622] border-white/[0.08] text-slate-300"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="font-mono text-[11px]">{dKey.slice(5)}</div>
                        <div className="text-[10px] opacity-80">{count} shifts</div>
                      </button>
                    );
                  })}
                </div>

                {/* Daily Agenda Grouped by Department */}
                {departmentGroups.map((grp) => (
                  <div
                    key={grp.department}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {grp.department}
                    </div>
                    <div className="space-y-2.5">
                      {grp.staff.map((emp) => {
                        const dayShifts = effectiveAssignments.filter(
                          (a) => a.employeeId === emp.id && a.shiftDate.slice(0, 10) === mobileSelectedDate
                        );
                        const avail = getAvailabilityForCell(emp.id, mobileSelectedDate);
                        const availBadge = AVAIL_BADGE_MAP[avail.type] || AVAIL_BADGE_MAP.NOT_UPDATED;
                        const assignedHrs = employeeVisibleWeekHours.get(emp.id) || 0;
                        const cap = getPolicyCap(emp);

                        return (
                          <div
                            key={emp.id}
                            className="p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {emp.firstName} {emp.lastName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {emp.employmentRecords?.[0]?.designation?.name || "Staff"} · {assignedHrs.toFixed(1)}h / {cap}h
                                </div>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${availBadge.cls}`}>
                                {availBadge.label}
                              </span>
                            </div>

                            {dayShifts.map((sh) => {
                              const dur = calcPaidHours(sh.startTime, sh.endTime, sh.breakMinutes);
                              return (
                                <button
                                  key={sh.id}
                                  type="button"
                                  onClick={() => openEditAssignmentModal(sh)}
                                  className="w-full p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs cursor-pointer"
                                >
                                  <span className="font-mono font-bold">
                                    {sh.startTime}–{sh.endTime} ({dur.hours}h)
                                  </span>
                                  <span className="text-[11px] text-[#0071E3] font-semibold">Edit</span>
                                </button>
                              );
                            })}

                            {canManageRoster && (
                              <button
                                type="button"
                                onClick={() => openCreateAssignmentModal(emp.id, mobileSelectedDate)}
                                className="w-full py-1.5 text-xs font-semibold rounded-xl border border-dashed border-black/15 dark:border-white/15 text-[#0071E3] cursor-pointer"
                              >
                                + Assign Shift
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* CREATE ROSTER MODAL */}
        {createRosterOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <form
              onSubmit={handleCreateRoster}
              className={`w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] rounded-3xl border flex flex-col overflow-hidden my-auto ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold">Create Shift Roster</h3>
                <button
                  type="button"
                  onClick={() => setCreateRosterOpen(false)}
                  aria-label="Close"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Roster Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bi-Weekly Dec 1–14"
                    value={newRosterName}
                    onChange={(e) => setNewRosterName(e.target.value)}
                    className="w-full min-w-0 max-w-full box-border px-3 py-2 text-xs rounded-xl border bg-transparent"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[11px] font-semibold mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={newRosterStart}
                      onChange={(e) => setNewRosterStart(e.target.value)}
                      className="w-full min-w-0 max-w-full box-border appearance-none px-3 py-2 text-xs rounded-xl border bg-transparent [&::-webkit-date-and-time-value]:text-left"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[11px] font-semibold mb-1">End Date *</label>
                    <input
                      type="date"
                      required
                      value={newRosterEnd}
                      onChange={(e) => setNewRosterEnd(e.target.value)}
                      className="w-full min-w-0 max-w-full box-border appearance-none px-3 py-2 text-xs rounded-xl border bg-transparent [&::-webkit-date-and-time-value]:text-left"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-[11px] font-semibold mb-1">Availability Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    value={newRosterDeadline}
                    onChange={(e) => setNewRosterDeadline(e.target.value)}
                    className="w-full min-w-0 max-w-full box-border appearance-none px-3 py-2 text-xs rounded-xl border bg-transparent [&::-webkit-date-and-time-value]:text-left"
                  />
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-black/[0.06] dark:border-white/[0.06] flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateRosterOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRoster}
                  className="px-4 py-2 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {creatingRoster ? "Creating..." : "Create Roster"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ASSIGNMENT EDITOR MODAL (Full-width on mobile) */}
        {editorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <form
              onSubmit={handleSaveAssignment}
              className={`w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-3xl border flex flex-col overflow-hidden ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-bold">
                  {editingAssignment ? "Edit Shift Assignment" : "Assign Shift"}
                </h3>
                <button type="button" onClick={() => setEditorOpen(false)} className="cursor-pointer">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {editorError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                    {editorError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Shift Date *</label>
                    <select
                      value={formShiftDate}
                      onChange={(e) => setFormShiftDate(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border ${
                        isDark ? "bg-[#090B10] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      {rosterDates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Shift Template</label>
                    <select
                      value={formTemplateId}
                      onChange={(e) => {
                        setFormTemplateId(e.target.value);
                        const t = templates.find((x) => x.id === e.target.value);
                        if (t) {
                          setFormStartTime(t.startTime);
                          setFormEndTime(t.endTime);
                          setFormBreakMinutes(t.breakMinutes);
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs rounded-xl border ${
                        isDark ? "bg-[#090B10] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <option value="">Custom Shift Time</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.startTime}–{t.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Start *</label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs rounded-xl border bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">End *</label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs rounded-xl border bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Unpaid Break (m)</label>
                    <input
                      type="number"
                      min="0"
                      value={formBreakMinutes}
                      onChange={(e) => setFormBreakMinutes(Number(e.target.value))}
                      className="w-full px-2.5 py-2 text-xs rounded-xl border bg-transparent"
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>
                    Scheduled paid duration:{" "}
                    <strong className="font-mono text-[#0071E3]">
                      {calcPaidHours(formStartTime, formEndTime, formBreakMinutes).hours} hrs
                    </strong>
                  </span>
                  {calcPaidHours(formStartTime, formEndTime, formBreakMinutes).isOvernight && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-semibold">
                      <Moon className="w-3 h-3" />
                      Overnight shift
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Assigned Employee *</label>
                    <select
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border ${
                        isDark ? "bg-[#090B10] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Role on Shift</label>
                    <input
                      type="text"
                      value={formRoleName}
                      onChange={(e) => setFormRoleName(e.target.value)}
                      placeholder="e.g. Line Cook, Server"
                      className="w-full px-3 py-2 text-xs rounded-xl border bg-transparent"
                    />
                  </div>
                </div>

                {/* Smart Staff Suggestions */}
                <div className="p-3.5 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Staff Suggestions ({formShiftDate})
                  </div>
                  {loadingSuggestions ? (
                    <p className="text-xs text-slate-400">Analyzing availability, leaves & weekly caps...</p>
                  ) : suggestions ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {[
                        ...suggestions.recommended,
                        ...suggestions.partiallyAvailable,
                        ...suggestions.unavailable,
                      ].map((sg) => {
                        const badge = AVAIL_BADGE_MAP[sg.availabilityType] || AVAIL_BADGE_MAP.NOT_UPDATED;
                        const selected = formEmployeeId === sg.employeeId;
                        return (
                          <button
                            key={sg.employeeId}
                            type="button"
                            onClick={() => setFormEmployeeId(sg.employeeId)}
                            className={`w-full p-2 rounded-xl border text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                              selected
                                ? "border-[#0071E3] bg-[#0071E3]/10"
                                : "border-black/[0.05] dark:border-white/[0.05]"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{sg.name}</div>
                              <div className="text-[10px] text-slate-500 truncate">{sg.reason}</div>
                            </div>
                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {/* Policy Override Option */}
                <div className="p-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formOverrideHours}
                      onChange={(e) => setFormOverrideHours(e.target.checked)}
                    />
                    <span>Override weekly policy hours warning (requires audit reason)</span>
                  </label>
                  {formOverrideHours && (
                    <input
                      type="text"
                      required
                      placeholder="Audit reason for overtime override..."
                      value={formOverrideReason}
                      onChange={(e) => setFormOverrideReason(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border bg-transparent"
                    />
                  )}
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                {editingAssignment ? (
                  <button
                    type="button"
                    disabled={savingAssignment}
                    onClick={handleDeleteAssignment}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl cursor-pointer"
                  >
                    Remove Shift
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAssignment}
                    className="px-4 py-2 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    {savingAssignment ? "Saving..." : "Save Shift"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* REVIEW & PUBLISH PANEL */}
        {reviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div
              className={`w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl border flex flex-col overflow-hidden ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Review & Publish Roster</h3>
                  {reviewData?.roster && (
                    <p className="text-xs text-slate-500">
                      {reviewData.roster.outlet?.name} · {reviewData.roster.startDate.slice(0, 10)} →{" "}
                      {reviewData.roster.endDate.slice(0, 10)} (v{reviewData.roster.version})
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setReviewOpen(false)} className="cursor-pointer">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                {loadingReview ? (
                  <p className="text-slate-400">Validating all shifts and computing diff...</p>
                ) : reviewData ? (
                  <>
                    {/* Blocking Issues */}
                    {reviewData.blockingIssues?.length > 0 && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                        <div className="font-bold text-rose-500 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" />
                          <span>{reviewData.blockingIssues.length} Blocking Issue(s)</span>
                        </div>
                        {reviewData.blockingIssues.map((iss: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-rose-600 dark:text-rose-300">
                            <span>{iss.message}</span>
                            {iss.assignmentId && (
                              <button
                                type="button"
                                onClick={() => {
                                  const match = effectiveAssignments.find((a) => a.id === iss.assignmentId);
                                  if (match) {
                                    setReviewOpen(false);
                                    openEditAssignmentModal(match);
                                  }
                                }}
                                className="underline font-semibold shrink-0 cursor-pointer"
                              >
                                Jump to shift
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {reviewData.warnings?.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                        <div className="font-bold text-amber-600 dark:text-amber-400">
                          {reviewData.warnings.length} Policy Override Warning(s)
                        </div>
                        {reviewData.warnings.map((w: any, i: number) => (
                          <div key={i} className="text-amber-700 dark:text-amber-300">
                            {w.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Diff Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-[10px] font-bold uppercase text-emerald-600">Added</div>
                        <div className="text-lg font-bold font-mono">{reviewData.diff?.added?.length || 0}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <div className="text-[10px] font-bold uppercase text-amber-600">Changed</div>
                        <div className="text-lg font-bold font-mono">{reviewData.diff?.changed?.length || 0}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                        <div className="text-[10px] font-bold uppercase text-rose-600">Removed</div>
                        <div className="text-lg font-bold font-mono">{reviewData.diff?.removed?.length || 0}</div>
                      </div>
                    </div>

                    {/* Detailed Diff Lists */}
                    {reviewData.diff?.added?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Added Shifts</div>
                        {reviewData.diff.added.map((a: any, idx: number) => {
                          const emp = a.employee || employees.find((e) => e.id === a.employeeId);
                          return (
                            <div key={idx} className="p-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] flex justify-between">
                              <span className="font-semibold">
                                {emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId}
                              </span>
                              <span className="font-mono">
                                {String(a.shiftDate).slice(0, 10)} · {a.startTime}–{a.endTime}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {reviewData.diff?.changed?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Changed Shifts</div>
                        {reviewData.diff.changed.map((c: any, idx: number) => {
                          const emp = employees.find((e) => e.id === c.after.employeeId);
                          return (
                            <div key={idx} className="p-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] flex justify-between">
                              <span className="font-semibold">
                                {emp ? `${emp.firstName} ${emp.lastName}` : c.after.employeeId}
                              </span>
                              <span className="font-mono">
                                {c.before.startTime}–{c.before.endTime} → {c.after.shiftDate} {c.after.startTime}–{c.after.endTime}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {reviewData.diff?.removed?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Removed Shifts</div>
                        {reviewData.diff.removed.map((r: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-rose-500/20 flex justify-between text-rose-500">
                            <span className="font-semibold">
                              {r.employee?.firstName} {r.employee?.lastName}
                            </span>
                            <span className="font-mono">
                              {String(r.shiftDate).slice(0, 10)} · {r.startTime}–{r.endTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className="px-6 py-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={publishing || loadingReview || !reviewData?.canPublish}
                  onClick={handlePublishRoster}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {publishing
                    ? "Publishing..."
                    : selectedRoster?.status === "PUBLISHED"
                    ? "Publish Revision & Notify Staff"
                    : "Publish Roster & Notify Staff"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
