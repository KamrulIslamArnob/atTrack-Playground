"use client";

import { useState, useEffect, useRef } from "react";
import {
  createProvider, updateProvider, testProviderConnection, fetchProviderModels, type FetchedModel, } from "@/lib/actions/ai-providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { X, Plug, CheckCircle2, AlertCircle } from "lucide-react";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { SearchIcon } from "@/components/ui/search";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
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
  anthropic: "claude-3-7-sonnet-20250219",
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

  // Connection test state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Model fetching & picker state
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [onlyFreeModels, setOnlyFreeModels] = useState(false);

  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Close model picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    const res = await testProviderConnection({
      id: provider?.id,
      provider_type: providerType,
      base_url: baseUrl,
      model: model || MODEL_PLACEHOLDER[providerType],
      api_key: apiKey || undefined,
    });

    setIsTestingConnection(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: `Connected (${res.latencyMs ?? 0}ms)`,
      });
      toast.success("Connection test successful");
    } else {
      setTestResult({
        success: false,
        message: res.error || "Connection failed.",
      });
      toast.error(res.error || "Connection test failed.");
    }
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);

    const res = await fetchProviderModels({
      id: provider?.id,
      provider_type: providerType,
      base_url: baseUrl,
      api_key: apiKey || undefined,
    });

    setIsFetchingModels(false);

    if (res.models && res.models.length > 0) {
      setFetchedModels(res.models);
      setShowModelPicker(true);
      if (res.models.some((m) => m.isFree)) {
        toast.success(`Fetched ${res.models.length} models (${res.models.filter((m) => m.isFree).length} free)`);
      } else {
        toast.success(`Fetched ${res.models.length} models`);
      }
    } else {
      toast.error(res.error || "Could not fetch models.");
    }
  };

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

    // create always verifies; update only re-verifies when the key changed —
    // `verified` is undefined there, so an unrelated edit (name, model) stays quiet.
    if (result.verified === true) {
      toast.success(`${provider ? "Provider updated" : "Provider added"} and verified.`);
    } else if (result.verified === false) {
      toast.warning(`${provider ? "Provider updated" : "Provider added"}, but the connection test failed: ${result.verifyError ?? "unknown error"}. AI features stay locked until it passes.`);
    } else {
      toast.success("Provider updated.");
    }
    setPending(false);
    onSaved();
  };

  const hasFreeModels = fetchedModels.some((m) => m.isFree);

  const filteredModels = fetchedModels.filter((m) => {
    if (onlyFreeModels && !m.isFree) return false;
    if (!modelSearch.trim()) return true;
    const query = modelSearch.toLowerCase();
    return m.id.toLowerCase().includes(query) || (m.name && m.name.toLowerCase().includes(query));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 max-h-[85vh] overflow-y-auto">
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
            <Select
              value={providerType}
              onValueChange={(v) => {
                setProviderType(v as ProviderType);
                setFetchedModels([]);
                setShowModelPicker(false);
                setTestResult(null);
              }}
            >
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
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setFetchedModels([]);
                  setShowModelPicker(false);
                }}
                placeholder="https://api.openai.com/v1"
                className="h-10"
                required
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setBaseUrl(preset.baseUrl);
                      setFetchedModels([]);
                      setShowModelPicker(false);
                    }}
                    className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                      baseUrl === preset.baseUrl
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 relative" ref={modelPickerRef}>
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-model">Model</Label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-green-800 dark:text-lime-400 hover:underline disabled:opacity-50"
              >
                {isFetchingModels ? <Spinner className="size-3" /> : <RefreshCWIcon className="size-3" />}
                Fetch Models
              </button>
            </div>

            <div className="relative">
              <Input
                id="provider-model"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                }}
                onFocus={() => {
                  if (fetchedModels.length > 0) setShowModelPicker(true);
                }}
                placeholder={MODEL_PLACEHOLDER[providerType]}
                className="h-10 pr-9"
                required
              />
              <button
                type="button"
                onClick={() => {
                  if (fetchedModels.length === 0) {
                    handleFetchModels();
                  } else {
                    setShowModelPicker((prev) => !prev);
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                title="Toggle models dropdown"
              >
                <ChevronDownIcon className="size-4" />
              </button>
            </div>

            {showModelPicker && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 rounded-2xl border border-border bg-card p-2 overflow-hidden space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Filter models..."
                      className="w-full rounded-xl border border-border bg-background py-1 pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  {hasFreeModels && (
                    <button
                      type="button"
                      onClick={() => setOnlyFreeModels(!onlyFreeModels)}
                      className={`rounded-xl border px-2 py-1 text-[11px] font-medium transition-colors ${
                        onlyFreeModels
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Free Only
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredModels.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">No matching models found.</p>
                  ) : (
                    filteredModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModel(m.id);
                          setShowModelPicker(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted hover:text-foreground ${
                          model === m.id ? "bg-muted font-medium text-foreground" : "text-foreground"
                        }`}
                      >
                        <div className="truncate max-w-[240px]">
                          <span className="font-mono text-foreground">{m.id}</span>
                          {m.name && m.name !== m.id && (
                            <span className="ml-1 text-[11px] text-muted-foreground truncate block">
                              {m.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {m.isFree && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0">
                              FREE
                            </Badge>
                          )}
                          {m.contextLength && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(m.contextLength / 1024)}k
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-api-key">API key</Label>
            <Input
              id="provider-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder={provider ? "••••••••••••" : "sk-..."}
              className="h-10"
              autoComplete="one-time-code"
              required={!provider}
            />
            {provider && <p className="text-[11px] text-muted-foreground">Leave blank to keep the current key.</p>}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-2.5">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {isTestingConnection ? <Spinner className="size-3.5" /> : <Plug className="size-3.5" />}
              Test Connection
            </button>

            {testResult && (
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  testResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}
              >
                {testResult.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                <span className="truncate max-w-[180px]">{testResult.message}</span>
              </div>
            )}
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

