"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Zap,
  ShieldCheck,
  Lock,
  Eye,
  Check,
} from "lucide-react";
import {
  getComposerSettings,
  setComposerSettings,
  PERMISSION_MODE_CONFIG,
  type PermissionMode,
} from "@/lib/ai-chatbot/composer-settings";
import { toast } from "sonner";

interface PermissionModeSelectorProps {
  className?: string;
  onChange?: (mode: PermissionMode) => void;
}

export function PermissionModeSelector({
  className,
  onChange,
}: PermissionModeSelectorProps) {
  const [mode, setMode] = useState<PermissionMode>("bypass");

  useEffect(() => {
    const s = getComposerSettings();
    setMode(s.permissionMode);
    onChange?.(s.permissionMode);

    const handleUpdate = () => {
      const updated = getComposerSettings();
      setMode(updated.permissionMode);
      onChange?.(updated.permissionMode);
    };

    window.addEventListener("attrack-composer-settings-updated", handleUpdate);
    return () => window.removeEventListener("attrack-composer-settings-updated", handleUpdate);
  }, [onChange]);

  const handleSelectMode = (newMode: PermissionMode) => {
    setMode(newMode);
    setComposerSettings({ permissionMode: newMode });
    onChange?.(newMode);
    toast.info(`Permission mode: ${PERMISSION_MODE_CONFIG[newMode].label}`);
  };

  const currentCfg = PERMISSION_MODE_CONFIG[mode] || PERMISSION_MODE_CONFIG.bypass;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60 cursor-pointer select-none",
          className
        )}
        title={`Autonomy & Permissions: ${currentCfg.label}`}
      >
        <span>{currentCfg.label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Autonomy &amp; Approvals
        </DropdownMenuLabel>

        {(Object.keys(PERMISSION_MODE_CONFIG) as PermissionMode[]).map((key) => {
          const cfg = PERMISSION_MODE_CONFIG[key];
          const isSelected = key === mode;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handleSelectMode(key)}
              className="flex items-start justify-between gap-2 text-xs py-2 cursor-pointer group"
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {key === "bypass" && <Zap className="size-3.5 text-amber-500" />}
                  {key === "ask" && <ShieldCheck className="size-3.5 text-primary" />}
                  {key === "strict" && <Lock className="size-3.5 text-rose-500" />}
                  {key === "readonly" && <Eye className="size-3.5 text-sky-500" />}
                </div>
                <div>
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    {cfg.label}
                    <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                      {cfg.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {cfg.description}
                  </p>
                </div>
              </div>
              {isSelected && <Check className="size-3.5 text-primary shrink-0 mt-0.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
