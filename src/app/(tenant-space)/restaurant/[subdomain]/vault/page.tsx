"use client";

import React, { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  browserGenerateSalt,
  browserDeriveMasterKey,
  browserComputeKeyVerifier,
  browserEncryptPayload,
  browserDecryptPayload,
} from "@/core/vault/browserCrypto";
import { generatePassword, evaluatePasswordStrength } from "@/core/vault/passwordGenerator";
import { generateTOTP } from "@/core/vault/totp";

interface VaultItem {
  id: string;
  title: string;
  itemType: "LOGIN" | "SECURE_NOTE" | "SOFTWARE_LICENSE" | "API_KEY" | "CREDIT_CARD";
  websiteUrl?: string | null;
  folderId?: string | null;
  encryptedData: string;
  iv: string;
  authTag: string;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  folder?: { id: string; name: string; color: string } | null;
  shares?: {
    id: string;
    permission: "READ_ONLY" | "AUTOFILL_ONLY" | "CAN_EDIT" | "FULL_CONTROL";
    recipient?: { id: string; name: string; email: string };
    role?: { id: string; name: string };
    department?: { id: string; name: string };
  }[];
}

interface DecryptedItemData {
  username?: string;
  password?: string;
  websiteUrl?: string;
  totpSecret?: string;
  notes?: string;
  licenseKey?: string;
  cardNumber?: string;
  cardholderName?: string;
  cardExpiry?: string;
  cardCvv?: string;
  apiKey?: string;
  apiSecret?: string;
}

interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  _count?: { items: number };
}

interface AuditLog {
  id: string;
  action: string;
  details?: string;
  createdAt: string;
  user: { name: string; email: string };
  vaultItem?: { title: string; itemType: string } | null;
}

export default function EnterpriseVaultPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  // Master Key in Session Memory
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profileSalt, setProfileSalt] = useState<string>("");
  const [verifierHash, setVerifierHash] = useState<string>("");

  // Unlock / Setup Inputs
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // Vault Items & Folders State
  const [items, setItems] = useState<VaultItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [decryptedData, setDecryptedData] = useState<DecryptedItemData | null>(null);
  const [decryptingItem, setDecryptingItem] = useState(false);

  // Navigation Filter State
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"ITEMS" | "SECURITY_DASHBOARD" | "AUDIT_LOGS">("ITEMS");

  // UI Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live TOTP State
  const [totpCode, setTotpCode] = useState<string>("");
  const [totpRemaining, setTotpRemaining] = useState<number>(30);

  // Breach Scanner State
  const [breachStatus, setBreachStatus] = useState<{ checked: boolean; isBreached: boolean; breachCount: number }>({
    checked: false,
    isBreached: false,
    breachCount: 0,
  });

  // Password Generator State
  const [genLength, setGenLength] = useState(20);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNums, setGenNums] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genMode, setGenMode] = useState<"PASSWORD" | "PASSPHRASE">("PASSWORD");
  const [generatedPassword, setGeneratedPassword] = useState("");

  // Create Item Form State
  const [formItemType, setFormItemType] = useState<"LOGIN" | "SECURE_NOTE" | "SOFTWARE_LICENSE" | "API_KEY" | "CREDIT_CARD">("LOGIN");
  const [formTitle, setFormTitle] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTotpSecret, setFormTotpSecret] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formFolderId, setFormFolderId] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");

  // Team & Role Sharing State
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; email: string; roleName?: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [shareTargetType, setShareTargetType] = useState<"USER" | "ROLE" | "DEPARTMENT">("USER");
  const [shareTargetId, setShareTargetId] = useState<string>("");
  const [sharePermission, setSharePermission] = useState<"READ_ONLY" | "AUTOFILL_ONLY" | "CAN_EDIT" | "FULL_CONTROL">("READ_ONLY");
  const [sharingLoading, setSharingLoading] = useState(false);

  const openShareDialog = async () => {
    setShowShareModal(true);
    try {
      const [resUsers, resRoles, resDept] = await Promise.all([
        fetch("/api/restaurant/users"),
        fetch("/api/restaurant/roles"),
        fetch("/api/restaurant/departments"),
      ]);

      let initialUserId = "";
      if (resUsers.ok) {
        const usersData = (await resUsers.json()).memberships || [];
        const parsedUsers = usersData
          .filter((m: any) => m.user)
          .map((m: any) => ({
            id: m.user.id,
            name: m.user.name || (m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : m.user.email),
            email: m.user.email,
            roleName: m.accessGrants?.[0]?.role?.name || "Member",
          }));
        setTeamUsers(parsedUsers);
        if (parsedUsers.length > 0) {
          initialUserId = parsedUsers[0].id;
        }
      }

      if (resRoles.ok) {
        const roleData = (await resRoles.json()).roles || [];
        setRoles(roleData);
      }

      if (resDept.ok) {
        const deptData = (await resDept.json()).departments || [];
        setDepartments(deptData);
      }

      if (shareTargetType === "USER" && initialUserId) {
        setShareTargetId(initialUserId);
      }
    } catch {
      // ignore
    }
  };

  const handleGrantShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !shareTargetId) return;
    setSharingLoading(true);

    try {
      const payload: any = {
        vaultItemId: selectedItem.id,
        permission: sharePermission,
      };

      if (shareTargetType === "USER") payload.recipientId = shareTargetId;
      else if (shareTargetType === "ROLE") payload.roleId = shareTargetId;
      else if (shareTargetType === "DEPARTMENT") payload.departmentId = shareTargetId;

      const res = await fetch("/api/restaurant/vault/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to grant share");

      // Refresh item details
      const itemRes = await fetch(`/api/restaurant/vault/items/${selectedItem.id}`);
      if (itemRes.ok) {
        const updatedItem = (await itemRes.json()).item;
        setSelectedItem(updatedItem);
      }
      fetchVaultData();
    } catch (err: any) {
      alert(err.message || "Failed to share item");
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm("Revoke access for this recipient?")) return;
    try {
      const res = await fetch(`/api/restaurant/vault/share?id=${shareId}`, { method: "DELETE" });
      if (res.ok && selectedItem) {
        const itemRes = await fetch(`/api/restaurant/vault/items/${selectedItem.id}`);
        if (itemRes.ok) {
          const updatedItem = (await itemRes.json()).item;
          setSelectedItem(updatedItem);
        }
        fetchVaultData();
      }
    } catch {
      // ignore
    }
  };

  // Check User Vault Profile on Mount
  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/restaurant/vault/profile");
      const data = await res.json();
      if (res.ok) {
        setHasProfile(data.hasVaultProfile);
        if (data.profile) {
          setProfileSalt(data.profile.masterSalt);
          setVerifierHash(data.profile.keyVerifierHash);
        }
      }
    } catch {
      setUnlockError("Failed to connect to vault security profile");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Fetch Items & Folders once unlocked
  const fetchVaultData = async () => {
    try {
      const [resItems, resFolders, resAudit] = await Promise.all([
        fetch("/api/restaurant/vault/items"),
        fetch("/api/restaurant/vault/folders"),
        fetch("/api/restaurant/vault/audit-logs"),
      ]);

      if (resItems.ok) setItems((await resItems.json()).items || []);
      if (resFolders.ok) setFolders((await resFolders.json()).folders || []);
      if (resAudit.ok) setAuditLogs((await resAudit.json()).auditLogs || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchVaultData();
    }
  }, [isUnlocked]);

  // Master Password Unlock / Setup Handler
  const handleUnlockOrSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError("");
    setUnlocking(true);

    try {
      if (!hasProfile) {
        // First Time Setup
        if (masterPasswordInput.length < 8) {
          throw new Error("Master Password must be at least 8 characters long.");
        }
        if (masterPasswordInput !== confirmPasswordInput) {
          throw new Error("Master Passwords do not match.");
        }

        const newSalt = await browserGenerateSalt(16);
        const derived = await browserDeriveMasterKey(masterPasswordInput, newSalt);
        const verifier = await browserComputeKeyVerifier(derived);

        const res = await fetch("/api/restaurant/vault/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ masterSalt: newSalt, keyVerifierHash: verifier }),
        });

        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(resData.error || (resData.details ? JSON.stringify(resData.details) : "Failed to save master vault profile."));
        }

        setMasterKey(derived);
        setIsUnlocked(true);
        setHasProfile(true);
        setProfileSalt(newSalt);
      } else {
        // Unlock Existing Vault
        const derived = await browserDeriveMasterKey(masterPasswordInput, profileSalt);
        const verifier = await browserComputeKeyVerifier(derived);

        if (verifier !== verifierHash) {
          throw new Error("Incorrect Master Password. Zero-knowledge decryption rejected.");
        }

        setMasterKey(derived);
        setIsUnlocked(true);
      }
      setMasterPasswordInput("");
      setConfirmPasswordInput("");
    } catch (err: any) {
      setUnlockError(err.message || "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  // Lock Vault
  const handleLockVault = () => {
    setMasterKey(null);
    setIsUnlocked(false);
    setSelectedItem(null);
    setDecryptedData(null);
  };

  // Decrypt Selected Item in Memory
  const handleSelectItem = async (item: VaultItem) => {
    setSelectedItem(item);
    setShowPassword(false);
    setBreachStatus({ checked: false, isBreached: false, breachCount: 0 });
    if (!masterKey) return;

    setDecryptingItem(true);
    try {
      const data = await browserDecryptPayload(item.encryptedData, item.iv, item.authTag, masterKey);
      setDecryptedData(data);

      // Check breach status if password exists
      if (data.password) {
        fetch("/api/restaurant/vault/breach-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: data.password }),
        })
          .then((r) => r.json())
          .then((b) => {
            if (b.success) {
              setBreachStatus({ checked: true, isBreached: b.isBreached, breachCount: b.breachCount });
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setDecryptedData({ notes: "Failed to decrypt secret payload with current master key." });
    } finally {
      setDecryptingItem(false);
    }
  };

  // Rolling TOTP Countdown Timer
  useEffect(() => {
    if (!decryptedData?.totpSecret) {
      setTotpCode("");
      return;
    }

    const updateOtp = () => {
      const { code, secondsRemaining } = generateTOTP(decryptedData.totpSecret || "");
      setTotpCode(code);
      setTotpRemaining(secondsRemaining);
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);
    return () => clearInterval(interval);
  }, [decryptedData?.totpSecret]);

  // Clipboard Copy with Auto-Audit
  const handleCopyClipboard = async (field: string, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);

    // Audit log copy event
    if (selectedItem && (field === "password" || field === "username" || field === "all_credentials")) {
      fetch(`/api/restaurant/vault/items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditAction: field === "password" ? "ITEM_COPIED_PASSWORD" : "ITEM_COPIED_USERNAME",
        }),
      }).catch(() => {});
    }
  };

  const handleCopyAllCredentials = async () => {
    if (!selectedItem || !decryptedData) return;
    const lines: string[] = [];
    lines.push(`Title: ${selectedItem.title}`);
    if (selectedItem.websiteUrl) lines.push(`URL: ${selectedItem.websiteUrl}`);
    if (decryptedData.username) lines.push(`Username: ${decryptedData.username}`);
    if (decryptedData.password) lines.push(`Password: ${decryptedData.password}`);
    if (decryptedData.licenseKey) lines.push(`License Key: ${decryptedData.licenseKey}`);
    if (decryptedData.apiKey) lines.push(`API Key: ${decryptedData.apiKey}`);
    if (decryptedData.apiSecret) lines.push(`API Secret: ${decryptedData.apiSecret}`);
    if (decryptedData.cardNumber) lines.push(`Card Number: ${decryptedData.cardNumber}`);
    if (decryptedData.cardholderName) lines.push(`Cardholder: ${decryptedData.cardholderName}`);
    if (decryptedData.cardExpiry) lines.push(`Card Expiry: ${decryptedData.cardExpiry}`);
    if (decryptedData.cardCvv) lines.push(`CVV: ${decryptedData.cardCvv}`);
    if (decryptedData.notes) lines.push(`Notes:\n${decryptedData.notes}`);

    await handleCopyClipboard("all_credentials", lines.join("\n"));
  };

  // Create Encrypted Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey) return;
    setSavingItem(true);

    try {
      const secretPayload: DecryptedItemData = {
        username: formUsername || undefined,
        password: formPassword || undefined,
        websiteUrl: formUrl || undefined,
        totpSecret: formTotpSecret || undefined,
        notes: formNotes || undefined,
      };

      const encrypted = await browserEncryptPayload(secretPayload, masterKey);

      const res = await fetch("/api/restaurant/vault/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          itemType: formItemType,
          websiteUrl: formUrl || undefined,
          folderId: formFolderId || undefined,
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save vault item");

      setShowCreateModal(false);
      setFormTitle("");
      setFormUsername("");
      setFormPassword("");
      setFormUrl("");
      setFormTotpSecret("");
      setFormNotes("");
      fetchVaultData();
    } catch (err: any) {
      alert(err.message || "Failed to create encrypted secret");
    } finally {
      setSavingItem(false);
    }
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    try {
      const res = await fetch("/api/restaurant/vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderNameInput }),
      });
      if (res.ok) {
        setShowFolderModal(false);
        setFolderNameInput("");
        fetchVaultData();
      }
    } catch {
      // ignore
    }
  };

  // Refresh Generated Password
  const refreshPassword = () => {
    const pwd = generatePassword({
      length: genLength,
      useUppercase: genUpper,
      useLowercase: genLower,
      useNumbers: genNums,
      useSymbols: genSymbols,
      mode: genMode,
    });
    setGeneratedPassword(pwd);
  };

  useEffect(() => {
    if (showGenerator) refreshPassword();
  }, [showGenerator, genLength, genUpper, genLower, genNums, genSymbols, genMode]);

  // Filter Items
  const filteredItems = items.filter((item) => {
    if (activeFilter === "FAVORITES" && !item.isFavorite) return false;
    if (activeFilter === "LOGIN" && item.itemType !== "LOGIN") return false;
    if (activeFilter === "SECURE_NOTE" && item.itemType !== "SECURE_NOTE") return false;
    if (activeFilter === "API_KEY" && item.itemType !== "API_KEY") return false;
    if (activeFilter === "SOFTWARE_LICENSE" && item.itemType !== "SOFTWARE_LICENSE") return false;
    if (selectedFolderId && item.folderId !== selectedFolderId) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // UNLOCK SCREEN
  if (!isUnlocked) {
    return (
      <ModuleAccessGuard moduleKey="vault" moduleName="Zero-Knowledge Vault" activeSection="Vault">
        <div
          className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col justify-between ${
            isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
          }`}
        >
          <RestaurantNavbar activeSection="Vault" />

        <div className="flex-1 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 ${
              isDark ? "bg-[#121622]/90 border-white/[0.08]" : "bg-white border-slate-200/80 shadow-slate-900/10"
            }`}
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                {hasProfile ? "Unlock Zero-Knowledge Vault" : "Setup Master Password"}
              </h1>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {hasProfile
                  ? "Enter your Master Password to decrypt secrets client-side via AES-256-GCM."
                  : "Create a Master Password. All credentials and documents will be encrypted before reaching our servers."}
              </p>
            </div>

            {unlockError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
                {unlockError}
              </div>
            )}

            <form onSubmit={handleUnlockOrSetup} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                  Master Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••••••"
                  value={masterPasswordInput}
                  onChange={(e) => setMasterPasswordInput(e.target.value)}
                  className={`w-full px-4 py-3 text-sm rounded-2xl border transition ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                  }`}
                />
              </div>

              {!hasProfile && (
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Confirm Master Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••••••"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className={`w-full px-4 py-3 text-sm rounded-2xl border transition ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                    }`}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={unlocking}
                className="w-full py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-bold rounded-2xl transition shadow-md shadow-[#0071E3]/20 cursor-pointer disabled:opacity-50"
              >
                {unlocking ? "Deriving Key & Verifying..." : hasProfile ? "Unlock Vault" : "Create Master Vault"}
              </button>
            </form>
          </div>
        </div>
      </div>
      </ModuleAccessGuard>
    );
  }

  // UNLOCKED 3-PANE ENTERPRISE VAULT UI
  return (
    <ModuleAccessGuard moduleKey="vault" moduleName="Zero-Knowledge Vault" activeSection="Vault">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Vault" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col space-y-4">
        {/* Top Control Header */}
        <div
          className={`p-4 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Zero-Knowledge Enterprise Vault
              </h1>
              <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                End-to-End AES-256-GCM Encrypted • {items.length} Secret Items Stored
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerator(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>Password Generator</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              + New Item
            </button>

            <button
              onClick={handleLockVault}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-rose-500 ${
                isDark ? "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20" : "bg-rose-50 border-rose-200 hover:bg-rose-100"
              }`}
            >
              Lock Vault
            </button>
          </div>
        </div>

        {/* 3-PANE LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* PANE 1: Folders & Categories (Left) */}
          <div className="lg:col-span-3 space-y-4">
            <div
              className={`p-4 rounded-3xl border transition space-y-4 ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              {/* Core Views */}
              <div className="space-y-1">
                <span className={`block text-[10px] font-bold uppercase tracking-wider mb-2 px-2 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Categories
                </span>
                {[
                  { key: "ALL", label: "All Vault Items", count: items.length },
                  { key: "FAVORITES", label: "Favorites", count: items.filter((i) => i.isFavorite).length },
                  { key: "LOGIN", label: "Logins & Credentials", count: items.filter((i) => i.itemType === "LOGIN").length },
                  { key: "SECURE_NOTE", label: "Secure Notes", count: items.filter((i) => i.itemType === "SECURE_NOTE").length },
                  { key: "API_KEY", label: "API & POS Keys", count: items.filter((i) => i.itemType === "API_KEY").length },
                  { key: "SOFTWARE_LICENSE", label: "Software Licenses", count: items.filter((i) => i.itemType === "SOFTWARE_LICENSE").length },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setActiveFilter(cat.key);
                      setSelectedFolderId(null);
                      setViewMode("ITEMS");
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition text-left flex justify-between items-center cursor-pointer ${
                      activeFilter === cat.key && !selectedFolderId && viewMode === "ITEMS"
                        ? "bg-[#0071E3] text-white shadow-xs"
                        : isDark
                        ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] font-mono opacity-80">{cat.count}</span>
                  </button>
                ))}
              </div>

              {/* Folders Section */}
              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <div className="flex justify-between items-center px-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                    Folders ({folders.length})
                  </span>
                  <button
                    onClick={() => setShowFolderModal(true)}
                    className="text-[11px] font-bold text-[#0071E3] hover:underline cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setViewMode("ITEMS");
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition text-left flex justify-between items-center cursor-pointer ${
                      selectedFolderId === folder.id && viewMode === "ITEMS"
                        ? "bg-[#0071E3] text-white shadow-xs"
                        : isDark
                        ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{folder.name}</span>
                    <span className="text-[10px] font-mono opacity-80">{folder._count?.items || 0}</span>
                  </button>
                ))}
              </div>

              {/* Tools Section */}
              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className={`block text-[10px] font-bold uppercase tracking-wider mb-2 px-2 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Enterprise Security
                </span>
                <button
                  onClick={() => setViewMode("AUDIT_LOGS")}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition text-left flex justify-between items-center cursor-pointer ${
                    viewMode === "AUDIT_LOGS"
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : isDark
                      ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span>Audit Logs</span>
                  <span className="text-[10px] font-mono opacity-80">{auditLogs.length}</span>
                </button>
              </div>
            </div>
          </div>

          {/* PANE 2 & 3: Items List & Decrypted Dossier */}
          {viewMode === "ITEMS" ? (
            <>
              {/* PANE 2: Item List (Center) */}
              <div className="lg:col-span-4 space-y-3">
                <input
                  placeholder="Search vault secrets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                  }`}
                />

                <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
                  {filteredItems.length === 0 ? (
                    <div className={`p-8 text-center text-xs space-y-1 rounded-2xl border ${isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-400"}`}>
                      <p className="font-semibold">No vault items found</p>
                      <p className="opacity-75">Click &quot;+ New Item&quot; to save a password or secret.</p>
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1 ${
                          selectedItem?.id === item.id
                            ? isDark
                              ? "bg-[#0071E3]/20 border-[#0071E3]/50 text-white"
                              : "bg-blue-50 border-blue-300 text-slate-900"
                            : isDark
                            ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14]"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold truncate">{item.title}</h4>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {item.itemType}
                          </span>
                        </div>

                        {item.websiteUrl && (
                          <p className={`text-[10px] truncate ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            {item.websiteUrl}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* PANE 3: Decrypted Detail Inspector (Right) */}
              <div className="lg:col-span-5">
                {selectedItem ? (
                  <div
                    className={`p-6 rounded-3xl border transition space-y-5 sticky top-6 ${
                      isDark ? "bg-[#121622]/80 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-md"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          isDark ? "bg-[#0071E3]/20 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-100 text-[#0071E3] border-blue-200"
                        }`}>
                          {selectedItem.itemType}
                        </span>
                        <h2 className="text-lg font-bold tracking-tight mt-1">{selectedItem.title}</h2>
                        {selectedItem.websiteUrl && (
                          <a
                            href={selectedItem.websiteUrl.startsWith("http") ? selectedItem.websiteUrl : `https://${selectedItem.websiteUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#0071E3] hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span>{selectedItem.websiteUrl}</span>
                            <span className="text-[10px]">↗</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyAllCredentials}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                            copiedField === "all_credentials"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500/40"
                              : isDark
                              ? "bg-white/[0.06] text-white border-white/[0.1] hover:bg-white/[0.1]"
                              : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{copiedField === "all_credentials" ? "Copied All!" : "Copy Credentials"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={openShareDialog}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                            isDark
                              ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/30 hover:bg-[#0071E3]/25"
                              : "bg-blue-50 text-[#0071E3] border-blue-200 hover:bg-blue-100"
                          }`}
                        >
                          <span>Share</span>
                          {selectedItem.shares && selectedItem.shares.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#0071E3] text-white font-bold">
                              {selectedItem.shares.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Breach Alert Warning Banner */}
                    {breachStatus.isBreached && (
                      <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <div className="text-xs">
                          <strong className="text-rose-400 block font-bold">Compromised in Known Data Breach</strong>
                          <span className={isDark ? "text-rose-200/80" : "text-rose-800"}>
                            This password has appeared in <strong>{breachStatus.breachCount.toLocaleString()}</strong> public data leaks. Change it immediately!
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Decrypted Fields */}
                    {decryptingItem ? (
                      <div className="py-8 text-center text-xs space-y-2">
                        <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto" />
                        <p>Decrypting secrets client-side...</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {/* Username Field */}
                        {decryptedData?.username && (
                          <div className={`p-3 rounded-2xl border flex justify-between items-center ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div>
                              <span className={`block text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Username / Email</span>
                              <span className="text-xs font-mono font-bold">{decryptedData.username}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyClipboard("username", decryptedData.username || "")}
                              className="px-2.5 py-1 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                            >
                              {copiedField === "username" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}

                        {/* Password Field */}
                        {decryptedData?.password && (
                          <div className={`p-3 rounded-2xl border space-y-2 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Password</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className={`text-xs font-medium cursor-pointer transition ${
                                    isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                                  }`}
                                >
                                  {showPassword ? "Hide" : "Reveal"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyClipboard("password", decryptedData.password || "")}
                                  className="px-2.5 py-0.5 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                                >
                                  {copiedField === "password" ? "Copied!" : "Copy"}
                                </button>
                              </div>
                            </div>
                            <p className="font-mono text-sm font-bold tracking-wider">
                              {showPassword ? decryptedData.password : "••••••••••••••••"}
                            </p>
                          </div>
                        )}

                        {/* Software License Key */}
                        {decryptedData?.licenseKey && (
                          <div className={`p-3 rounded-2xl border flex justify-between items-center ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div>
                              <span className={`block text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>License Key</span>
                              <span className="text-xs font-mono font-bold">{decryptedData.licenseKey}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyClipboard("licenseKey", decryptedData.licenseKey || "")}
                              className="px-2.5 py-1 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                            >
                              {copiedField === "licenseKey" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}

                        {/* API Key */}
                        {decryptedData?.apiKey && (
                          <div className={`p-3 rounded-2xl border flex justify-between items-center ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div>
                              <span className={`block text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>API Key / Client ID</span>
                              <span className="text-xs font-mono font-bold">{decryptedData.apiKey}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyClipboard("apiKey", decryptedData.apiKey || "")}
                              className="px-2.5 py-1 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                            >
                              {copiedField === "apiKey" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}

                        {/* API Secret */}
                        {decryptedData?.apiSecret && (
                          <div className={`p-3 rounded-2xl border flex justify-between items-center ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div>
                              <span className={`block text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>API Secret</span>
                              <span className="text-xs font-mono font-bold">••••••••••••••••</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyClipboard("apiSecret", decryptedData.apiSecret || "")}
                              className="px-2.5 py-1 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                            >
                              {copiedField === "apiSecret" ? "Copied!" : "Copy Secret"}
                            </button>
                          </div>
                        )}

                        {/* Credit Card Details */}
                        {decryptedData?.cardNumber && (
                          <div className={`p-3 rounded-2xl border space-y-2 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div className="flex justify-between items-center">
                              <div>
                                <span className={`block text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Payment Card</span>
                                <span className="text-xs font-mono font-bold">{decryptedData.cardNumber}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyClipboard("cardNumber", decryptedData.cardNumber || "")}
                                className="px-2.5 py-1 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                              >
                                {copiedField === "cardNumber" ? "Copied!" : "Copy Card"}
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Name</span>
                                <span className="font-semibold">{decryptedData.cardholderName || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Expiry</span>
                                <span className="font-semibold">{decryptedData.cardExpiry || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">CVV</span>
                                <span className="font-semibold">{decryptedData.cardCvv || "•••"}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Live TOTP Authenticator Code */}
                        {totpCode && (
                          <div className={`p-4 rounded-2xl border flex justify-between items-center ${
                            isDark ? "bg-[#0071E3]/10 border-[#0071E3]/30" : "bg-blue-50 border-blue-200"
                          }`}>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#64B5FF]" : "text-blue-900"}`}>
                                  2FA One-Time Passcode
                                </span>
                              </div>
                              <span className="text-2xl font-mono font-extrabold tracking-widest text-[#0071E3] block mt-1">
                                {totpCode}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="font-mono text-xs font-bold text-slate-400">{totpRemaining}s</span>
                              <button
                                type="button"
                                onClick={() => handleCopyClipboard("totp", totpCode)}
                                className="block mt-1 px-3 py-1 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                {copiedField === "totp" ? "Copied!" : "Copy Code"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Secret Notes */}
                        {decryptedData?.notes && (
                          <div className={`p-3 rounded-2xl border space-y-1 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                            <div className="flex justify-between items-center">
                              <span className={`block text-[10px] font-semibold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>Encrypted Notes</span>
                              <button
                                type="button"
                                onClick={() => handleCopyClipboard("notes", decryptedData.notes || "")}
                                className="px-2 py-0.5 text-xs text-[#0071E3] font-semibold hover:underline cursor-pointer"
                              >
                                {copiedField === "notes" ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{decryptedData.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-12 text-center text-xs rounded-3xl border ${isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-400"}`}>
                    <p className="font-semibold">Select a vault item to inspect</p>
                    <p className="opacity-75">Your credentials are automatically decrypted client-side.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* AUDIT LOGS VIEW */
            <div className="lg:col-span-9">
              <div className={`p-6 rounded-3xl border space-y-4 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200"}`}>
                <h3 className="text-sm font-bold uppercase tracking-wider">Enterprise Vault Audit Logs</h3>
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className={`p-3 rounded-2xl border flex justify-between items-center text-xs ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50"}`}>
                      <div>
                        <strong className="block font-bold">{log.action}</strong>
                        <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>{log.details}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[10px] opacity-75">{new Date(log.createdAt).toLocaleString()}</span>
                        <span className="block text-[10px] text-[#0071E3]">{log.user.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CREATE VAULT ITEM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">New Encrypted Vault Secret</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Item Type</label>
                  <select
                    value={formItemType}
                    onChange={(e) => setFormItemType(e.target.value as any)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                  >
                    <option value="LOGIN">Login & Password</option>
                    <option value="SECURE_NOTE">Secure Note</option>
                    <option value="API_KEY">API & POS Key</option>
                    <option value="SOFTWARE_LICENSE">Software License</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Folder</label>
                  <select
                    value={formFolderId}
                    onChange={(e) => setFormFolderId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                  >
                    <option value="">No Folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. POS Admin Login or Supplier Portal"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                />
              </div>

              {formItemType === "LOGIN" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Username / Email</label>
                      <input
                        type="text"
                        placeholder="chef@restaurant.com"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Website URL</label>
                    <input
                      type="text"
                      placeholder="https://pos.system.com/login"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">TOTP 2FA Secret Key (Optional)</label>
                    <input
                      type="text"
                      placeholder="JBSWY3DPEHPK3PXP"
                      value={formTotpSecret}
                      onChange={(e) => setFormTotpSecret(e.target.value)}
                      className={`w-full px-3.5 py-2 text-xs font-mono rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Encrypted Notes</label>
                <textarea
                  rows={3}
                  placeholder="Additional recovery keys or confidential information..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs">Cancel</button>
                <button type="submit" disabled={savingItem} className="px-5 py-2 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer">
                  {savingItem ? "Encrypting..." : "Encrypt & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD GENERATOR DRAWER */}
      {showGenerator && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">Password Generator</h2>
              <button onClick={() => setShowGenerator(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className={`p-4 rounded-2xl border font-mono text-sm break-all flex items-center justify-between gap-2 ${
              isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
            }`}>
              <span className="font-bold text-[#0071E3]">{generatedPassword}</span>
              <button
                onClick={() => handleCopyClipboard("password", generatedPassword)}
                className="px-2.5 py-1 text-xs bg-[#0071E3] text-white font-semibold rounded-lg flex-shrink-0 cursor-pointer"
              >
                {copiedField === "password" ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span>Length: {genLength} chars</span>
                <input
                  type="range"
                  min="10"
                  max="40"
                  value={genLength}
                  onChange={(e) => setGenLength(parseInt(e.target.value))}
                  className="w-40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={genUpper} onChange={(e) => setGenUpper(e.target.checked)} />
                  <span>A-Z Uppercase</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={genLower} onChange={(e) => setGenLower(e.target.checked)} />
                  <span>a-z Lowercase</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={genNums} onChange={(e) => setGenNums(e.target.checked)} />
                  <span>0-9 Numbers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={genSymbols} onChange={(e) => setGenSymbols(e.target.checked)} />
                  <span>!@#$ Symbols</span>
                </label>
              </div>
            </div>

            <button
              onClick={refreshPassword}
              className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold rounded-xl cursor-pointer"
            >
              🔄 Regenerate Password
            </button>
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white"}`}>
            <h2 className="text-base font-bold">New Vault Folder</h2>
            <form onSubmit={handleCreateFolder} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Folder Name (e.g. POS Keys)"
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-3 py-1.5 text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer">Create Folder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENTERPRISE TEAM SHARING MODAL */}
      {showShareModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                  isDark ? "bg-[#0071E3]/20 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-100 text-[#0071E3] border-blue-200"
                }`}>
                  Secure Sharing
                </span>
                <h2 className="text-base font-bold tracking-tight mt-1.5">
                  Share &quot;{selectedItem.title}&quot;
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Grant granular access to teammates, roles, or entire departments.
                </p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className={`cursor-pointer transition ${isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900"}`}
              >
                ✕
              </button>
            </div>

            {/* Grant Access Form */}
            <form onSubmit={handleGrantShare} className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
            }`}>
              <span className={`block text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Grant New Access
              </span>

              {/* Target Type Selector */}
              <div className="flex rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-1 border border-black/[0.04] dark:border-white/[0.04]">
                {(["USER", "ROLE", "DEPARTMENT"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setShareTargetType(type);
                      if (type === "USER" && teamUsers.length > 0) {
                        setShareTargetId(teamUsers[0].id);
                      } else if (type === "ROLE" && roles.length > 0) {
                        setShareTargetId(roles[0].id);
                      } else if (type === "DEPARTMENT" && departments.length > 0) {
                        setShareTargetId(departments[0].id);
                      }
                    }}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      shareTargetType === type
                        ? "bg-[#0071E3] text-white shadow-xs"
                        : isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {type === "USER" ? "Team Member" : type === "ROLE" ? "Role" : "Department"}
                  </button>
                ))}
              </div>

              {/* Target Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {shareTargetType === "USER" ? "Select Team Member" : shareTargetType === "ROLE" ? "Select Role" : "Select Department"}
                  </label>
                  <select
                    value={shareTargetId}
                    onChange={(e) => setShareTargetId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200"
                    }`}
                  >
                    {shareTargetType === "USER" && (
                      teamUsers.length === 0 ? (
                        <option value="">No other team user accounts found</option>
                      ) : (
                        teamUsers.map((u) => {
                          const existing = selectedItem.shares?.find((s) => s.recipient?.id === u.id);
                          return (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email}) — {u.roleName || "Member"}
                              {existing ? ` [Granted: ${existing.permission.replace("_", " ")}]` : ""}
                            </option>
                          );
                        })
                      )
                    )}

                    {shareTargetType === "ROLE" && (
                      roles.length === 0 ? (
                        <option value="">No custom roles configured</option>
                      ) : (
                        roles.map((r) => {
                          const existing = selectedItem.shares?.find((s) => s.role?.id === r.id);
                          return (
                            <option key={r.id} value={r.id}>
                              Role: {r.name}
                              {existing ? ` [Granted: ${existing.permission.replace("_", " ")}]` : ""}
                            </option>
                          );
                        })
                      )
                    )}

                    {shareTargetType === "DEPARTMENT" && (
                      departments.length === 0 ? (
                        <option value="">No departments configured</option>
                      ) : (
                        departments.map((d) => {
                          const existing = selectedItem.shares?.find((s) => s.department?.id === d.id);
                          return (
                            <option key={d.id} value={d.id}>
                              Department: {d.name}
                              {existing ? ` [Granted: ${existing.permission.replace("_", " ")}]` : ""}
                            </option>
                          );
                        })
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Permission Level</label>
                  <select
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value as any)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="READ_ONLY">Read Only (View &amp; Copy)</option>
                    <option value="AUTOFILL_ONLY">Autofill Only (Hide Password)</option>
                    <option value="CAN_EDIT">Can Edit Secrets</option>
                    <option value="FULL_CONTROL">Full Control (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={sharingLoading || !shareTargetId}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {sharingLoading ? "Granting Access..." : "Grant Access"}
                </button>
              </div>
            </form>

            {/* Existing Active Shares List */}
            <div className="space-y-2">
              <span className={`block text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Active Access Grants ({selectedItem.shares?.length || 0})
              </span>

              {(!selectedItem.shares || selectedItem.shares.length === 0) ? (
                <p className={`text-xs py-3 text-center ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  This secret is currently private to you.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedItem.shares.map((share) => (
                    <div
                      key={share.id}
                      className={`p-3 rounded-2xl border flex justify-between items-center text-xs ${
                        isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <strong className="block font-semibold">
                          {share.recipient
                            ? (share.recipient.name || share.recipient.email)
                            : share.role
                            ? `Role: ${share.role.name}`
                            : share.department
                            ? `Department: ${share.department.name}`
                            : "Shared Grant"}
                        </strong>
                        <span className={`text-[11px] block ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          {share.recipient
                            ? share.recipient.email
                            : share.role
                            ? "All members assigned to this role"
                            : share.department
                            ? "All staff assigned to this department"
                            : "Access grant"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          share.permission === "FULL_CONTROL"
                            ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-500/40"
                            : share.permission === "CAN_EDIT"
                            ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-500/40"
                            : share.permission === "AUTOFILL_ONLY"
                            ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-500/40"
                            : "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-500/40"
                        }`}>
                          {share.permission.replace("_", " ")}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRevokeShare(share.id)}
                          className="px-2.5 py-1 text-xs text-rose-500 hover:underline cursor-pointer font-medium"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  isDark ? "bg-white/[0.04] text-white hover:bg-white/[0.08]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
