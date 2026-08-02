"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Upload, Loader2 } from "lucide-react";
import { uploadAvatar } from "@/lib/actions/auth";

interface AvatarUploadProps {
  avatarUrl?: string | null;
  fullName?: string | null;
}

export function AvatarUpload({ avatarUrl, fullName }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert("File size must be less than 500KB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    await uploadAvatar(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="relative">
          {preview || avatarUrl ? (
            <Image
              src={preview || avatarUrl || ""}
              alt="Avatar"
              width={96}
              height={96}
              className="size-24 rounded-full object-cover ring-4 ring-background"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground ring-4 ring-background">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-card text-foreground ring-2 ring-background transition-colors hover:bg-muted"
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            name="avatar"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div>
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG or GIF. Max 500KB.
          </p>
          {preview && (
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-4xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
                onClick={() => setPreview(null)}
                className="inline-flex items-center gap-2 rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {!preview && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="size-4" />
          Upload
        </button>
      )}
    </form>
  );
}
