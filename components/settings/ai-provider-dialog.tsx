"use client";

import { useState } from "react";
import { createProvider, updateProvider } from "@/lib/actions/ai-providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  OPENAI_COMPATIBLE_PRESETS,
  type AiProviderSummary,
  type ProviderType,
} from "@/lib/types/ai-providers";

const MODEL_PLACEHOLDER: Record<ProviderType, string> = {
  gemini: "models/gemini-2.0-flash",
  anthropic: "claude-sonnet-4-20250514",
  openai_compatible: "gpt-4o-mini",
};

interface AiProviderDialogProps {
  provider: AiProviderSummary | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}

export function AiProviderDialog({ provider, onClose, onSaved }: AiProviderDialogProps) {
  const [name, setName] = useState(provider?.name ?? "");
  const [providerType, setProviderType] = useState<ProviderType>(provider?.provider_type ?? "gemini");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "");
  const [model, setModel] = useState(provider?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);

    const result = provider
      ? await updateProvider(provider.id, {
          name,
          provider_type: providerType,
          base_url: baseUrl,
          model,
          api_key: apiKey || undefined,
        })
      : await createProvider({ name, provider_type: providerType, base_url: baseUrl, model, api_key: apiKey });

    if (result.error) {
      toast.error(result.error);
      setPending(false);
      return;
    }

    toast.success(provider ? "Provider updated." : "Provider added.");
    setPending(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">{provider ? "Edit provider" : "Add provider"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My OpenRouter key"
              className="h-10"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-type">Type</Label>
            <Select value={providerType} onValueChange={(v) => setProviderType(v as ProviderType)}>
              <SelectTrigger id="provider-type" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROVIDER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {providerType === "openai_compatible" && (
            <div className="space-y-2">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="h-10"
                required
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setBaseUrl(preset.baseUrl)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="provider-model">Model</Label>
            <Input
              id="provider-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={MODEL_PLACEHOLDER[providerType]}
              className="h-10"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-api-key">API key</Label>
            <Input
              id="provider-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider ? "••••••••••••" : "sk-..."}
              className="h-10"
              autoComplete="one-time-code"
              required={!provider}
            />
            {provider && <p className="text-[11px] text-muted-foreground">Leave blank to keep the current key.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending && <Spinner className="mr-2" />}
              {provider ? "Save" : "Add provider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
