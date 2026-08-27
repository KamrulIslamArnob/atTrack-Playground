/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, FileImage, Loader2, Trash2 } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { saveAvatar, deleteAvatar } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  avatarUrl?: string | null;
  fullName?: string | null;
}

export function AvatarUpload({ avatarUrl: initialAvatarUrl, fullName }: AvatarUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null | undefined>(initialAvatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setCurrentAvatarUrl(initialAvatarUrl);
    setImageError(false);
  }, [initialAvatarUrl]);

  useEffect(() => {
    const onAvatarUpdated = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setCurrentAvatarUrl(detail || null);
      setImageError(false);
      setPreview(null);
    };
    window.addEventListener("avatar-updated", onAvatarUpdated);
    return () => window.removeEventListener("avatar-updated", onAvatarUpdated);
  }, []);

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const validExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      toast.error("Please select a JPG, PNG, GIF, WebP, or SVG image");
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return false;
    }
    return true;
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!validateFile(file)) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    setImageError(false);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await saveAvatar(formData);
      if (result.success && result.avatarUrl) {
        toast.success("Profile photo updated");
        setCurrentAvatarUrl(result.avatarUrl);
        setPreview(null);
        setImageError(false);
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: result.avatarUrl }));
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to upload avatar.");
        setPreview(null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar.");
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      setDialogOpen(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
      setDialogOpen(false);
    }
  }, [uploadFile]);

  const handleDeleteAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const res = await deleteAvatar();
      if (res.success) {
        toast.success("Profile photo removed");
        setCurrentAvatarUrl(null);
        setPreview(null);
        setImageError(false);
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: "" }));
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to remove avatar");
      }
    } catch {
      toast.error("Failed to remove avatar");
    } finally {
      setIsDeleting(false);
    }
  };

  const displayUrl = preview || (!imageError && currentAvatarUrl ? currentAvatarUrl : null);

  return (
    <>
      <div className="relative group shrink-0">
        {/* Compact Clickable Avatar */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={isUploading}
          title="Click to change photo"
          className={cn(
            "relative size-14 sm:size-16 rounded-xl overflow-hidden border border-border/80 bg-muted/60 shadow-2xs transition-all duration-150 cursor-pointer block",
            "hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragOver && "border-primary ring-2 ring-primary/40 scale-105"
          )}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={fullName || "Profile avatar"}
              className="size-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-sm font-bold text-foreground/80 select-none">
              {initials}
            </div>
          )}

          {/* Hover overlay with camera icon */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 backdrop-blur-[1px]">
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
          </div>
        </button>

        {/* Delete Photo Tiny Button if avatar exists */}
        {currentAvatarUrl && (
          <button
            type="button"
            disabled={isDeleting || isUploading}
            onClick={handleDeleteAvatar}
            title="Remove photo"
            className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-card border border-border text-muted-foreground shadow-2xs transition-transform hover:scale-110 hover:text-destructive active:scale-95 cursor-pointer opacity-0 group-hover:opacity-100"
          >
            {isDeleting ? <Loader2 className="size-2.5 animate-spin" /> : <Trash2 className="size-2.5" />}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-e4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-card-foreground">
                Upload photo
              </h2>
              <button
                onClick={() => setDialogOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <FileImage className="size-8 text-muted-foreground" />
              <p className="mt-2 text-xs font-medium">
                Drop image or click to browse
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                JPG, PNG, GIF, WebP. Max 5MB.
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDialogOpen(false)}
                className="micro-press inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
