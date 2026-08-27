"use client";

export interface LocalFolderWorkspace {
  id: string;
  name: string;
  path: string;
  noteCount?: number;
  fileCount?: number;
  lastScanned?: string;
  isActive?: boolean;
}

const STORAGE_KEY = "attrack_local_workspace_folders_v1";
const ACTIVE_KEY = "attrack_active_local_folder_id_v1";

const DEFAULT_FOLDERS: LocalFolderWorkspace[] = [];

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("attrack-local-folders-updated"));
}

export function getLocalFolders(): LocalFolderWorkspace[] {
  if (typeof window === "undefined") return DEFAULT_FOLDERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FOLDERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_FOLDERS;
  } catch {
    return DEFAULT_FOLDERS;
  }
}

export function saveLocalFolders(folders: LocalFolderWorkspace[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    notify();
  } catch {
    /* ignore storage quota */
  }
}

export function getActiveLocalFolderId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const active = window.localStorage.getItem(ACTIVE_KEY);
    if (active) return active;
    const all = getLocalFolders();
    const found = all.find((f) => f.isActive);
    return found?.id || all[0]?.id || null;
  } catch {
    return null;
  }
}

export function getActiveLocalFolder(): LocalFolderWorkspace | null {
  const all = getLocalFolders();
  if (all.length === 0) return null;
  const activeId = getActiveLocalFolderId();
  return all.find((f) => f.id === activeId) || all[0] || null;
}

export function setActiveLocalFolder(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
    const all = getLocalFolders();
    const updated = all.map((f) => ({
      ...f,
      isActive: f.id === id,
    }));
    saveLocalFolders(updated);
  } catch {}
}

export function addLocalFolder(folder: Omit<LocalFolderWorkspace, "id">): LocalFolderWorkspace {
  const all = getLocalFolders();
  const id = `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newFolder: LocalFolderWorkspace = {
    ...folder,
    id,
    isActive: true,
  };
  const updated: LocalFolderWorkspace[] = [
    ...all.map((f) => ({ ...f, isActive: false })),
    newFolder,
  ];
  saveLocalFolders(updated);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_KEY, id);
  }
  return newFolder;
}

export function removeLocalFolder(id: string): void {
  const all = getLocalFolders();
  if (all.length <= 1) return;
  const filtered = all.filter((f) => f.id !== id);
  if (getActiveLocalFolderId() === id) {
    filtered[0].isActive = true;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_KEY, filtered[0].id);
    }
  }
  saveLocalFolders(filtered);
}

export function updateLocalFolder(id: string, partial: Partial<LocalFolderWorkspace>): void {
  const all = getLocalFolders();
  const updated = all.map((f) => (f.id === id ? { ...f, ...partial } : f));
  saveLocalFolders(updated);
}
