"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Camera, FileImage, Loader2, Trash2 } from "lucide-react";
import { UploadIcon } from "@/components/ui/upload";
import { XIcon } from "@/components/ui/x";
import { saveAvatar, deleteAvatar } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, GIF, or WebP image");
      return false;
    }
    if (file.size > 500 * 1024) {
      toast.error("File size must be less than 500KB");
      return false;
    }
    return true;
  };

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      setImageError(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
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
      handleFile(file);
      setDialogOpen(false);
    }
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", selectedFile);
      const result = await saveAvatar(formData);
      if (result.success && result.avatarUrl) {
        toast.success("Profile photo updated");
        setCurrentAvatarUrl(result.avatarUrl);
        setPreview(null);
        setSelectedFile(null);
        setImageError(false);
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: result.avatarUrl }));
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to upload avatar.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setSelectedFile(null);
    setImageError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteAvatar = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteAvatar();
      if (res.success) {
        toast.success("Profile photo removed");
        setCurrentAvatarUrl(null);
        setPreview(null);
        setSelectedFile(null);
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <div className="relative">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Avatar"
                className="size-24 rounded-full object-cover ring-4 ring-background"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground ring-4 ring-background">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-card text-foreground ring-2 ring-background transition-colors hover:bg-muted"
            >
              <Camera className="size-4" />
            </button>
          </div>

          <div>
            <p className="text-sm font-medium">Profile photo</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, GIF or WebP. Max 500KB.
            </p>
            {preview && (
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  Save avatar
                </button>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {!preview && (
          <div className="flex items-center gap-2">
            {currentAvatarUrl && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAvatar}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="Remove photo"
              >
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <UploadIcon className="size-4" />
              Upload
            </button>
          </div>
        )}
      </form>

      <input
        ref={fileInputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-medium text-card-foreground">
                Upload avatar
              </h2>
              <button
                onClick={() => setDialogOpen(false)}
                className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <FileImage className="size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                Drop your image here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, GIF or WebP. Max 500KB.
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDialogOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
