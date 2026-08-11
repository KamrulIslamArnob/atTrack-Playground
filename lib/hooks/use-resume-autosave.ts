"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveResumeBuilderDocument } from "@/lib/actions/resume-builder";
import type { ResumeDoc } from "@/lib/types/resume-builder";

interface UseAutoSaveOptions {
  id: string;
  name: string;
  doc: ResumeDoc;
  dirty: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
  onSaving: () => void;
}

export function useAutoSave({ id, name, doc, dirty, onSaved, onError, onSaving }: UseAutoSaveOptions) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async () => {
    if (!dirty || isSaving) return;
    setIsSaving(true);
    onSaving();
    try {
      await saveResumeBuilderDocument(id, name, doc);
      onSaved();
      router.refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save resume.");
    } finally {
      setIsSaving(false);
    }
  }, [id, name, doc, dirty, isSaving, onSaved, onError, onSaving, router]);

  // Debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save();
    }, 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doc, dirty, save]);

  return { save, isSaving };
}
