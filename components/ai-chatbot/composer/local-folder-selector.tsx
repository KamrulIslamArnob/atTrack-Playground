"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Laptop,
  Folder,
  FolderPlus,
  Check,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FolderGit2,
  Server,
  Cloud,
} from "lucide-react";
import { PixelMascot } from "./pixel-mascot";
import {
  getLocalFolders,
  getActiveLocalFolder,
  setActiveLocalFolder,
  addLocalFolder,
  removeLocalFolder,
  type LocalFolderWorkspace,
} from "@/lib/ai-chatbot/local-folders";
import {
  getComposerSettings,
  setComposerSettings,
  type ExecutionTarget,
} from "@/lib/ai-chatbot/composer-settings";
import { validateLocalVault, type LocalVaultValidationResult } from "@/lib/actions/local-folder";
import { toast } from "sonner";

interface LocalFolderSelectorProps {
  className?: string;
  onActiveFolderChange?: (folder: LocalFolderWorkspace) => void;
}

export function LocalFolderSelector({
  className,
  onActiveFolderChange,
}: LocalFolderSelectorProps) {
  const [folders, setFolders] = useState<LocalFolderWorkspace[]>([]);
  const [activeFolder, setActiveFolder] = useState<LocalFolderWorkspace | null>(null);
  const [target, setTarget] = useState<ExecutionTarget>("local");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Add folder dialog state
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [validationResult, setValidationResult] = useState<LocalVaultValidationResult | null>(null);

  const refreshFolders = useCallback(() => {
    const list = getLocalFolders();
    setFolders(list);
    const active = getActiveLocalFolder();
    setActiveFolder(active);
    if (active) onActiveFolderChange?.(active);
    const settings = getComposerSettings();
    setTarget(settings.executionTarget);
  }, [onActiveFolderChange]);

  useEffect(() => {
    refreshFolders();
    const handleUpdate = () => refreshFolders();
    window.addEventListener("attrack-local-folders-updated", handleUpdate);
    window.addEventListener("attrack-composer-settings-updated", handleUpdate);
    return () => {
      window.removeEventListener("attrack-local-folders-updated", handleUpdate);
      window.removeEventListener("attrack-composer-settings-updated", handleUpdate);
    };
  }, [refreshFolders]);

  const handleSelectFolder = (id: string) => {
    setActiveLocalFolder(id);
    const selected = folders.find((f) => f.id === id);
    if (selected) {
      setActiveFolder(selected);
      onActiveFolderChange?.(selected);
      toast.info(`Active folder: ${selected.name}`);
    }
  };

  const handleSelectTarget = (newTarget: ExecutionTarget) => {
    setTarget(newTarget);
    setComposerSettings({ executionTarget: newTarget });
    toast.info(`Execution target: ${newTarget.toUpperCase()}`);
  };

  const handleValidate = async () => {
    if (!newPath.trim()) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await validateLocalVault(newPath.trim());
      setValidationResult(res);
      if (res.valid && !newName) {
        setNewName(res.vaultName);
      }
    } catch (e) {
      setValidationResult({
        valid: false,
        normalizedPath: newPath,
        vaultName: "",
        noteCount: 0,
        sampleNotes: [],
        error: String(e),
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleBrowseFolder = async () => {
    // Electron native folder picker — gives absolute path the server can validate
    const electronAPI = (window as unknown as { electronAPI?: { pickFolder?: () => Promise<string | null> } }).electronAPI;
    if (electronAPI?.pickFolder) {
      setIsPickingFolder(true);
      try {
        const picked = await electronAPI.pickFolder();
        if (picked) {
          setNewPath(picked);
          setValidationResult(null);
          // Auto-scan after pick so user sees Valid Workspace immediately
          setIsValidating(true);
          try {
            const res = await validateLocalVault(picked);
            setValidationResult(res);
            if (res.valid && !newName) {
              setNewName(res.vaultName);
            }
          } catch (e) {
            setValidationResult({
              valid: false,
              normalizedPath: picked,
              vaultName: "",
              noteCount: 0,
              sampleNotes: [],
              error: String(e),
            });
          } finally {
            setIsValidating(false);
          }
        }
      } finally {
        setIsPickingFolder(false);
      }
      return;
    }

    // Non-Electron fallback: try File System Access API directory picker (client-side handle)
    // Server still needs an absolute path string, so we can only use this to *hint* the path.
    // If not available, keep manual input.
    const anyWindow = window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> };
    if (anyWindow.showDirectoryPicker) {
      try {
        const handle = await anyWindow.showDirectoryPicker();
        // We only get the folder name, not absolute path — use it as display name hint
        if (handle?.name && !newName) setNewName(handle.name);
        toast.info("Selected folder name captured — please confirm the full absolute path for server access.");
      } catch {
        // User cancelled picker
      }
      return;
    }

    toast.info("Browse is available in the desktop app. Please type or paste the full folder path.");
  };

  const handleAddFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath.trim()) return;

    const name = newName.trim() || validationResult?.vaultName || "Folder";
    const path = validationResult?.normalizedPath || newPath.trim();

    const created = addLocalFolder({
      name,
      path,
      noteCount: validationResult?.noteCount ?? 0,
      fileCount: validationResult?.fileCount ?? 0,
      lastScanned: new Date().toISOString(),
    });

    toast.success(`Connected local folder "${created.name}" — Tracky can now read & write files there`);
    setIsAddDialogOpen(false);
    setNewPath("");
    setNewName("");
    setValidationResult(null);
  };

  const handleDeleteFolder = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (folders.length <= 1) {
      toast.warning("Cannot remove the sole local folder.");
      return;
    }
    removeLocalFolder(id);
    toast.info(`Removed "${name}"`);
  };

  const displayName = activeFolder?.name || "Local Workspace";

  return (
    <div className={cn("flex items-center justify-between gap-2 px-1 pb-1.5 pt-0.5", className)}>
      {/* Left chips container */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* 💻 Local Native Status Pill */}
        <div
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground select-none"
          title="Local execution: queries and tools run natively on your machine."
        >
          <Laptop className="size-3.5 text-foreground/80" />
          <span>Local</span>
        </div>

        {/* 📁 Connected Local Folder Pill or Add Folder CTA */}
        {folders.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border cursor-pointer select-none max-w-[200px]"
              title={`Active Folder: ${activeFolder?.path || displayName}`}
            >
              <Folder className="size-3.5 shrink-0 text-foreground/80" />
              <span className="truncate">{displayName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Local Workspaces
                </span>
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {folders.length} connected
                </Badge>
              </div>

              <div className="max-h-56 overflow-y-auto py-1">
                {folders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => handleSelectFolder(f.id)}
                    className="flex items-center justify-between text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderGit2 className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                      <div className="min-w-0">
                        <div className="font-medium truncate text-foreground">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono">
                          {f.path}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {f.id === activeFolder?.id && (
                        <Check className="size-3.5 text-primary" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFolder(e, f.id, f.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                        title="Remove folder"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setIsAddDialogOpen(true)}
                className="flex items-center gap-2 text-xs font-medium text-primary cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add local folder...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/40 hover:bg-muted/80 hover:border-primary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer select-none"
            title="Connect a local workspace directory"
          >
            <FolderPlus className="size-3.5 text-primary" />
            <span>Connect Folder</span>
          </button>
        )}

        {/* Single Add Folder trigger — shown only when a folder already exists; empty state uses Connect Folder button */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          {folders.length > 0 && (
            <DialogTrigger
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground hover:border-border cursor-pointer"
              title="Add another local workspace folder"
            >
              <FolderPlus className="size-3.5" />
            </DialogTrigger>
          )}

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FolderPlus className="size-4 text-primary" />
                Add Local Workspace Folder
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pick a folder to give Tracky <span className="font-medium text-foreground">read &amp; write</span> access right here — it can list, read, and edit files in this directory.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddFolderSubmit} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  Folder Path <span className="text-[10px] font-normal text-muted-foreground">(Tracky will read &amp; write here)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. C:/Users/Projects/my-app or /home/notes"
                    value={newPath}
                    onChange={(e) => {
                      setNewPath(e.target.value);
                      setValidationResult(null);
                    }}
                    className="text-xs font-mono flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseFolder}
                    disabled={isPickingFolder || isValidating}
                    className="shrink-0 text-xs gap-1.5"
                    title="Browse for folder (native picker in desktop app)"
                  >
                    {isPickingFolder ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Folder className="size-3.5" />
                    )}
                    Browse
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleValidate}
                    disabled={!newPath.trim() || isValidating}
                    className="shrink-0 text-xs"
                  >
                    {isValidating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "Scan"
                    )}
                  </Button>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Choose any folder on your machine. Tracky will have <span className="font-medium text-foreground">read &amp; write</span> access right here — no display name needed, just the path.
                </p>
              </div>

              {/* Validation feedback */}
              {validationResult && (
                <div
                  className={cn(
                    "rounded-xl border p-3 text-xs space-y-1.5 transition-all",
                    validationResult.valid
                      ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                      : "border-destructive/30 bg-destructive/5 text-destructive"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {validationResult.valid ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>Valid Workspace Directory</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-4 text-destructive" />
                        <span>Folder Inaccessible</span>
                      </>
                    )}
                  </div>

                  {validationResult.valid ? (
                    <div className="text-[11px] text-muted-foreground space-y-1">
                      <p>
                        Found{" "}
                        <span className="font-semibold text-foreground">
                          {validationResult.noteCount} notes
                        </span>{" "}
                        ({validationResult.fileCount ?? 0} total indexed files).
                      </p>
                      {validationResult.sampleNotes.length > 0 && (
                        <div className="font-mono text-[10px] bg-background/60 p-1.5 rounded border border-border/40 max-h-20 overflow-y-auto">
                          {validationResult.sampleNotes.slice(0, 4).map((n: string, i: number) => (
                            <div key={i} className="truncate">
                              📄 {n}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px]">{validationResult.error}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  Display Name <span className="text-[11px] font-normal text-muted-foreground">(auto-filled, optional)</span>
                </label>
                <Input
                  placeholder="Auto-filled from folder — leave empty if fine"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">Only for your sidebar — the path above is what grants access.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newPath.trim() || isValidating}
                  className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save &amp; Connect
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Right mascot sprite */}
      <div className="flex items-center gap-1.5 pl-2">
        <PixelMascot size={19} />
      </div>
    </div>
  );
}
