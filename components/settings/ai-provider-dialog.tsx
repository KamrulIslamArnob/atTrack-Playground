"use client";

import { useState, useEffect, useRef } from "react";
import {
  createProvider,
  updateProvider,
  testProviderConnection,
  fetchProviderModels,
  type FetchedModel,
} from "@/lib/actions/ai-providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plug, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { SearchIcon } from "@/components/ui/search";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { toast } from "sonner";
import {
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  ALL_AI_PRESETS,
  AI_PRESET_CATEGORIES,
  type AiPreset,
  type PresetCategory,
  type AiProviderSummary,
  type ProviderType,
} from "@/lib/types/ai-providers";

const MODEL_PLACEHOLDER: Record<ProviderType, string> = {
  gemini: "gemini-2.5-flash",
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
  const [providerType, setProviderType] = useState<ProviderType>(provider?.provider_type ?? "openai_compatible");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "https://api.openai.com/v1");
  const [model, setModel] = useState(provider?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);

  // Preset category tab
  const [activeCategory, setActiveCategory] = useState<PresetCategory>("major");

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

  const isLocalEndpoint =
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("0.0.0.0") ||
    baseUrl.includes("11434") ||
    baseUrl.includes("1234");

  const handleApplyPreset = (preset: AiPreset) => {
    setName(preset.name);
    setProviderType(preset.providerType);
    setBaseUrl(preset.defaultBaseUrl || (preset.providerType === "openai_compatible" ? "https://api.openai.com/v1" : ""));
    setModel(preset.defaultModel);
    setFetchedModels([]);
    setShowModelPicker(false);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    const res = await testProviderConnection({
      id: provider?.id,
      provider_type: providerType,
      base_url: providerType === "openai_compatible" ? baseUrl : undefined,
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
      base_url: providerType === "openai_compatible" ? baseUrl : undefined,
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
          base_url: providerType === "openai_compatible" ? baseUrl : undefined,
          model,
          api_key: apiKey || undefined,
        })
      : await createProvider({
          name,
          provider_type: providerType,
          base_url: providerType === "openai_compatible" ? baseUrl : undefined,
          model,
          api_key: apiKey,
        });

    if (result.error) {
      toast.error(result.error);
      setPending(false);
      return;
    }

    if (result.verified === true) {
      toast.success(`${provider ? "Provider updated" : "Provider added"} and verified.`);
    } else if (result.verified === false) {
      toast.warning(
        `${provider ? "Provider updated" : "Provider added"}, but connection test failed: ${result.verifyError ?? "unknown error"}. AI features stay locked until it passes.`
      );
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

  const categoryPresets = ALL_AI_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">{provider ? "Edit provider" : "Add AI provider"}</h2>
            <p className="text-xs text-muted-foreground">Configure model credentials and endpoint details.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {/* Quick Preset Selector — gradient tint distinct from form blocks */}
        {!provider && (
          <div className="mb-4 rounded-xl border border-primary/15 bg-gradient-brand-tint p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Quick Presets
              </span>
              <span className="text-[10px] text-muted-foreground">{ALL_AI_PRESETS.length} presets</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {AI_PRESET_CATEGORIES.map((cat) => {
                const count = ALL_AI_PRESETS.filter((p) => p.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-primary hover:bg-primary/10"
                    }`}
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {categoryPresets.map((preset) => {
                const isActive = name === preset.name || (baseUrl && baseUrl === preset.defaultBaseUrl);
                const isHighlightedBadge = preset.badge === "Free tier" || preset.badge === "Local";
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`group flex items-center justify-between h-7 px-2.5 rounded-lg border text-left text-xs font-medium transition-colors micro-press cursor-pointer ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/60 bg-card text-foreground hover:border-primary/30 hover:bg-gradient-brand-tint-strong hover:text-primary"
                    }`}
                  >
                    <span className="truncate">{preset.name}</span>
                    {preset.badge && (
                      <span
                        className={`ml-1.5 shrink-0 rounded-md border px-1 py-0.2 text-[9px] font-semibold leading-none ${
                          isHighlightedBadge
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground group-hover:border-primary/20"
                        }`}
                      >
                        {preset.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider Name */}
          <div className="space-y-1.5">
            <Label htmlFor="provider-name" className="text-xs font-medium">Provider Display Name</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OpenAI, OpenRouter, Local Ollama"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Provider Type */}
          <div className="space-y-1.5">
            <Label htmlFor="provider-type" className="text-xs font-medium">Protocol Type</Label>
            <Select
              value={providerType}
              onValueChange={(v) => {
                setProviderType(v as ProviderType);
                setFetchedModels([]);
                setShowModelPicker(false);
                setTestResult(null);
              }}
            >
              <SelectTrigger id="provider-type" className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {PROVIDER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SEQUENCE 1: API Key (optional for local endpoints) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-api-key" className="text-xs font-medium">
                API Key {isLocalEndpoint && <span className="text-muted-foreground font-normal">(Optional for local endpoints)</span>}
              </Label>
            </div>
            <div className="flex gap-2">
              <Input
                id="provider-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={provider ? "••••••••••••" : isLocalEndpoint ? "local (optional)" : "sk-..."}
                className="h-9 text-xs font-mono flex-1"
                autoComplete="one-time-code"
                required={!provider && !isLocalEndpoint && providerType !== "gemini"}
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="h-9 px-3 text-xs font-medium rounded-xl border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isTestingConnection ? <Spinner className="size-3.5" /> : <Plug className="size-3.5" />}
                <span>Test</span>
              </button>
            </div>
            {provider && <p className="text-[11px] text-muted-foreground">Leave blank to keep the current key.</p>}
            {testResult && (
              <div
                className={`flex items-center gap-1.5 text-xs font-medium pt-1 ${
                  testResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}
              >
                {testResult.success ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                <span className="truncate">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* SEQUENCE 2: Base URL / API Endpoint */}
          {providerType === "openai_compatible" && (
            <div className="space-y-1.5">
              <Label htmlFor="provider-base-url" className="text-xs font-medium">Base URL / API Endpoint</Label>
              <Input
                id="provider-base-url"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setFetchedModels([]);
                  setShowModelPicker(false);
                }}
                placeholder="https://api.openai.com/v1"
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          )}

          {/* SEQUENCE 3: Model Selection (Dynamic Fetch) */}
          <div className="space-y-1.5 relative" ref={modelPickerRef}>
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-model" className="text-xs font-medium">Model Selection</Label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 cursor-pointer"
              >
                {isFetchingModels ? <Spinner className="size-3" /> : <RefreshCWIcon className="size-3" />}
                <span>Fetch Models</span>
              </button>
            </div>

            <div className="relative">
              <Input
                id="provider-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                onFocus={() => {
                  if (fetchedModels.length > 0) setShowModelPicker(true);
                }}
                placeholder={MODEL_PLACEHOLDER[providerType]}
                className="h-9 pr-8 text-xs font-mono"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Toggle models dropdown"
              >
                <ChevronDownIcon className="size-3.5" />
              </button>
            </div>

            {/* Dropdown Menu for Fetched Models */}
            {showModelPicker && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 rounded-2xl border border-border bg-card p-2 shadow-xl space-y-2 animate-in fade-in-50">
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
                      className={`rounded-xl border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                        onlyFreeModels
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Free Only
                    </button>
                  )}
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
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
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted hover:text-foreground cursor-pointer ${
                          model === m.id ? "bg-muted font-medium text-foreground" : "text-foreground"
                        }`}
                      >
                        <div className="truncate max-w-[260px]">
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
                            <span className="text-[10px] text-muted-foreground font-mono">
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

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {pending && <Spinner className="mr-2" />}
              {provider ? "Save changes" : "Add provider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
