"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { completeOnboarding, skipOnboarding } from "@/lib/actions/onboarding";
import { testProviderConnection } from "@/lib/actions/ai-providers";
import { saveAvatar } from "@/lib/actions/auth";
import { extractTextFromPDF } from "@/lib/utils/pdf-extract";
import type { ProviderType } from "@/lib/types/ai-providers";
import {
  User,
  Briefcase,
  FileText,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Upload,
  Bot,
  Layers,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Camera,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface OnboardingWizardProps {
  isOpen: boolean;
  profileName?: string | null;
  userEmail?: string | null;
  onFinished?: () => void;
}

type Step = 1 | 2 | 3 | 4;

const AI_PRESETS: {
  id: string;
  name: string;
  providerType: ProviderType;
  defaultModel: string;
  defaultBaseUrl?: string;
  badge?: string;
  placeholder: string;
  helpUrl: string;
}[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    providerType: "gemini",
    defaultModel: "gemini-2.5-flash",
    badge: "Free tier",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    providerType: "anthropic",
    defaultModel: "claude-3-5-sonnet-20241022",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    providerType: "openai_compatible",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "ollama",
    name: "Local / Ollama",
    providerType: "openai_compatible",
    defaultModel: "llama3.2:latest",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    badge: "Local",
    placeholder: "ollama (optional)",
    helpUrl: "https://ollama.com",
  },
  {
    id: "custom",
    name: "Custom Endpoint",
    providerType: "openai_compatible",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    badge: "Custom API",
    placeholder: "sk-...",
    helpUrl: "https://openrouter.ai",
  },
];

const CUSTOM_ENDPOINT_PRESETS = [
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct" },
  { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { label: "Together AI", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { label: "LM Studio", baseUrl: "http://localhost:1234/v1", model: "local-model" },
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
] as const;

export function OnboardingWizard({
  isOpen,
  profileName,
  userEmail,
  onFinished,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(isOpen);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Profile & Target Role
  const [fullName, setFullName] = useState(profileName || "");
  const [email, setEmail] = useState(userEmail || "");
  const [targetRole, setTargetRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<"entry" | "mid" | "senior">("mid");
  const [step1Touched, setStep1Touched] = useState(false);

  // Step 2: Master Resume
  const [resumeMode, setResumeMode] = useState<"upload" | "paste">("upload");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [extractingPdf, setExtractingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: AI Engine (BYOK & Custom Endpoints)
  const [selectedPresetId, setSelectedPresetId] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [customProviderName, setCustomProviderName] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [keyVerified, setKeyVerified] = useState<boolean | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Step 4: First Try / Seed Data
  const [seedDemoData, setSeedDemoData] = useState(true);

  const selectedPreset = AI_PRESETS.find((p) => p.id === selectedPresetId) ?? AI_PRESETS[0];

  const isPlaceholderEmail = (value: string) => value.trim().toLowerCase().endsWith("@attrack.local");
  const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const step1Errors = {
    fullName: fullName.trim() ? null : "Enter your name",
    email: !email.trim()
      ? "Enter your email"
      : isPlaceholderEmail(email) || !isValidEmailFormat(email)
      ? "Enter a valid email address"
      : null,
    targetRole: targetRole.trim() ? null : "Enter your target role",
  };
  const isStep1Valid = !step1Errors.fullName && !step1Errors.email && !step1Errors.targetRole;

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarJustUploaded, setAvatarJustUploaded] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, or GIF image");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("File size must be less than 500KB");
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await saveAvatar(formData);
      if (result.success && result.avatarUrl) {
        setAvatarPreview(result.avatarUrl);
        setAvatarJustUploaded(true);
        setTimeout(() => setAvatarJustUploaded(false), 700);
      } else {
        toast.error(result.error || "Couldn't upload avatar");
      }
    } catch {
      toast.error("Couldn't upload avatar");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a valid PDF document");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be smaller than 10MB");
      return;
    }

    setResumeFile(file);
    setResumeFileName(file.name);
    setExtractingPdf(true);

    try {
      const text = await extractTextFromPDF(file);
      if (text && text.trim().length > 0) {
        setResumeText(text);
        toast.success(`Loaded "${file.name}"`);
      } else {
        toast.error("Couldn't extract text from this PDF. You can paste resume text directly.");
      }
    } catch {
      toast.error("Couldn't read PDF. You can paste resume text directly.");
    } finally {
      setExtractingPdf(false);
    }
  };

  const handleTestApiKey = async () => {
    const key = apiKey.trim();
    const isLocalEndpoint =
      selectedPreset.id === "ollama" ||
      baseUrl.includes("localhost") ||
      baseUrl.includes("127.0.0.1") ||
      baseUrl.includes("0.0.0.0");

    if (!key && !isLocalEndpoint && selectedPreset.providerType !== "gemini") {
      toast.error("Enter an API key to test");
      return;
    }

    setTestingKey(true);
    setVerifyError(null);

    const modelToTest = customModel.trim() || selectedPreset.defaultModel;
    const urlToTest =
      selectedPreset.providerType === "openai_compatible"
        ? (baseUrl.trim() || selectedPreset.defaultBaseUrl || "https://api.openai.com/v1")
        : undefined;

    try {
      const res = await testProviderConnection({
        provider_type: selectedPreset.providerType,
        model: modelToTest,
        api_key: key || (isLocalEndpoint ? "ollama" : "dummy-key"),
        base_url: urlToTest,
      });

      if (res.success) {
        setKeyVerified(true);
        toast.success(
          res.latencyMs
            ? `AI connection verified (${res.latencyMs}ms)`
            : "AI connection verified successfully"
        );
      } else {
        setKeyVerified(false);
        setVerifyError(res.error || "Connection failed");
        toast.error(res.error || "AI connection failed");
      }
    } catch (err) {
      setKeyVerified(false);
      const msg = err instanceof Error ? err.message : "Connection failed";
      setVerifyError(msg);
      toast.error(msg);
    } finally {
      setTestingKey(false);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const isLocalEndpoint =
        selectedPreset.id === "ollama" ||
        baseUrl.includes("localhost") ||
        baseUrl.includes("127.0.0.1") ||
        baseUrl.includes("0.0.0.0");

      const hasAi =
        Boolean(apiKey.trim()) ||
        isLocalEndpoint ||
        (selectedPreset.id === "custom" && Boolean(baseUrl.trim()));

      const aiPayload = hasAi
        ? {
            name:
              selectedPreset.id === "custom"
                ? (customProviderName.trim() || "Custom AI Endpoint")
                : selectedPreset.name,
            providerType: selectedPreset.providerType,
            apiKey: apiKey.trim() || (isLocalEndpoint ? "ollama" : "custom"),
            model: customModel.trim() || selectedPreset.defaultModel,
            baseUrl:
              selectedPreset.providerType === "openai_compatible"
                ? (baseUrl.trim() || selectedPreset.defaultBaseUrl || "https://api.openai.com/v1")
                : undefined,
          }
        : undefined;

      const res = await completeOnboarding({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
        experienceLevel,
        resumeText: resumeText.trim() || undefined,
        resumeFileName: resumeFileName || undefined,
        aiProvider: aiPayload,
        seedDemoData,
      });

      if (res.success) {
        toast.success(
          res.seededCount && res.seededCount > 0
            ? "Workspace ready with demo pipeline"
            : "Workspace ready"
        );
        setOpen(false);
        onFinished?.();
        router.refresh();
      } else {
        toast.error(res.error || "Couldn't save setup");
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipAll = async () => {
    setSubmitting(true);
    try {
      await skipOnboarding();
      toast.info("Skipped onboarding");
      setOpen(false);
      onFinished?.();
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't skip setup");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <ThemeLogo width={24} height={24} />
            <div>
              <h2 className="font-heading font-semibold text-base leading-tight">Welcome to atTrack</h2>
              <p className="text-xs text-muted-foreground">Local-first career workspace</p>
            </div>
          </div>
          {step > 1 && (
            <button
              onClick={handleSkipAll}
              disabled={submitting}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors px-2 py-1 rounded-md hover:bg-muted"
            >
              Skip setup
            </button>
          )}
        </div>

        {/* Step Progress Stepper */}
        <div className="grid grid-cols-4 border-b border-border/40 bg-muted/10 px-6 py-2.5 gap-2">
          {[
            { s: 1, label: "Profile", icon: User },
            { s: 2, label: "Resume", icon: FileText },
            { s: 3, label: "AI Engine", icon: Sparkles },
            { s: 4, label: "First Try", icon: Layers },
          ].map(({ s, label, icon: Icon }) => {
            const isActive = step === s;
            const isCompleted = step > s;
            return (
              <div
                key={s}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-primary font-semibold"
                    : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                <div
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "border border-primary text-primary bg-primary/10"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="size-3" /> : s}
                </div>
                <span className="hidden sm:inline truncate">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: Profile & Target Role */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">Tell us about yourself</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set up your primary target role and seniority to calibrate fit scoring and resume match analysis.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-medium text-primary-foreground ring-4 ring-background">
                    <AnimatePresence mode="wait">
                      {avatarPreview ? (
                        <motion.img
                          key="photo"
                          src={avatarPreview}
                          alt="Your avatar"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className="size-full object-cover"
                        />
                      ) : (
                        <motion.span
                          key="initials"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {(fullName || "U").trim().charAt(0).toUpperCase()}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {avatarJustUploaded && (
                    <motion.span
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-card text-foreground ring-2 ring-background transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {avatarUploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Profile photo</p>
                  <p className="text-[11px] text-muted-foreground">Optional — JPG, PNG or GIF, max 500KB</p>
                </div>
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kamrul Islam"
                    aria-invalid={step1Touched && Boolean(step1Errors.fullName)}
                    className={`w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                      step1Touched && step1Errors.fullName ? "border-destructive" : "border-border"
                    }`}
                  />
                  {step1Touched && step1Errors.fullName && (
                    <p className="mt-1 text-xs text-destructive">{step1Errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Your email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. kamrul@example.com"
                    aria-invalid={step1Touched && Boolean(step1Errors.email)}
                    className={`w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                      step1Touched && step1Errors.email ? "border-destructive" : "border-border"
                    }`}
                  />
                  {step1Touched && step1Errors.email && (
                    <p className="mt-1 text-xs text-destructive">{step1Errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Target job title <span className="text-muted-foreground font-normal">(Primary role)</span>
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Senior Full Stack Engineer, Product Designer"
                    aria-invalid={step1Touched && Boolean(step1Errors.targetRole)}
                    className={`w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                      step1Touched && step1Errors.targetRole ? "border-destructive" : "border-border"
                    }`}
                  />
                  {step1Touched && step1Errors.targetRole && (
                    <p className="mt-1 text-xs text-destructive">{step1Errors.targetRole}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Experience level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "entry", label: "Entry-level", sub: "0-2 years" },
                      { id: "mid", label: "Mid-level", sub: "2-5 years" },
                      { id: "senior", label: "Senior / Lead", sub: "5+ years" },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setExperienceLevel(lvl.id as "entry" | "mid" | "senior")}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                          experienceLevel === lvl.id
                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                            : "border-border bg-card text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span className="text-xs font-semibold">{lvl.label}</span>
                        <span className="text-[10px] text-muted-foreground">{lvl.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Master Resume */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">Add your master resume</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  atTrack compares job postings against your resume to compute match scores and draft tailored cover letters.
                </p>
              </div>

              <div className="flex gap-2 border-b border-border/60 pb-2">
                <button
                  type="button"
                  onClick={() => setResumeMode("upload")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    resumeMode === "upload"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  onClick={() => setResumeMode("paste")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    resumeMode === "paste"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Paste text
                </button>
              </div>

              {resumeMode === "upload" ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-center"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {extractingPdf ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-8 text-primary animate-spin" />
                      <p className="text-xs font-medium">Extracting resume text...</p>
                    </div>
                  ) : resumeText ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-success-surface text-success">
                        <Check className="size-5" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">{resumeFileName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {resumeText.length.toLocaleString()} characters extracted. Click to change file.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Upload className="size-5" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">Drop your resume PDF here or click to browse</p>
                      <p className="text-[11px] text-muted-foreground">Supports searchable PDF files up to 10MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    rows={7}
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your resume text here (experience, skills, education)..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {resumeText.length > 0 ? `${resumeText.length.toLocaleString()} characters` : "Optional — you can add this anytime in Documents"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: AI Engine (BYOK & Custom Endpoints) */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">Connect AI engine</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bring your own API key or connect custom API endpoints (OpenRouter, DeepSeek, Groq, Ollama, local models). Keys stay encrypted locally.
                </p>
              </div>

              {/* Provider Selection Cards */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {AI_PRESETS.map((p) => {
                  const isSelected = selectedPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(p.id);
                        setKeyVerified(null);
                        setVerifyError(null);
                        if (p.id === "ollama") {
                          setBaseUrl("http://127.0.0.1:11434/v1");
                          setCustomModel("llama3.2:latest");
                        } else if (p.id === "custom") {
                          if (!baseUrl || baseUrl.includes("11434")) {
                            setBaseUrl("https://api.deepseek.com/v1");
                            setCustomModel("deepseek-chat");
                          }
                        } else if (p.defaultBaseUrl) {
                          setBaseUrl(p.defaultBaseUrl);
                          setCustomModel(p.defaultModel);
                        }
                      }}
                      className={`flex flex-col items-start gap-0.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                          : "border-border bg-card text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span className="flex w-full items-start justify-between gap-1.5">
                        <span className="line-clamp-2 break-words text-xs font-semibold leading-tight">
                          {p.name}
                        </span>
                        {p.badge && (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${
                              p.badge === "Free tier"
                                ? "border-success-border bg-success-surface text-success"
                                : "border-info-border bg-info-surface text-info"
                            }`}
                          >
                            {p.badge}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 w-full break-words text-[10px] leading-tight text-muted-foreground">
                        {p.defaultModel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Configuration Form */}
              <div className="space-y-3 pt-1">
                {selectedPreset.id === "custom" && (
                  <div className="space-y-3">
                    {/* Quick Presets */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                        Quick Presets:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {CUSTOM_ENDPOINT_PRESETS.map((cp) => (
                          <button
                            key={cp.label}
                            type="button"
                            onClick={() => {
                              setBaseUrl(cp.baseUrl);
                              setCustomModel(cp.model);
                              setCustomProviderName(cp.label);
                              setKeyVerified(null);
                              setVerifyError(null);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                              baseUrl === cp.baseUrl
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            {cp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          Base URL / API Endpoint <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          value={baseUrl}
                          onChange={(e) => {
                            setBaseUrl(e.target.value);
                            setKeyVerified(null);
                            setVerifyError(null);
                          }}
                          placeholder="https://api.deepseek.com/v1"
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          Model Identifier <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          value={customModel}
                          onChange={(e) => {
                            setCustomModel(e.target.value);
                            setKeyVerified(null);
                            setVerifyError(null);
                          }}
                          placeholder="e.g. deepseek-chat, gpt-4o, llama-3.3-70b"
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-foreground">
                          API Key <span className="text-muted-foreground font-normal">(Optional for local endpoints)</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value);
                            setKeyVerified(null);
                            setVerifyError(null);
                          }}
                          placeholder="sk-..."
                          className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={handleTestApiKey}
                          disabled={testingKey}
                          className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {testingKey ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : keyVerified ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Sparkles className="size-3.5" />
                          )}
                          <span>{testingKey ? "Testing..." : keyVerified ? "Verified" : "Test"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPreset.id === "ollama" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                          Ollama Base URL
                        </label>
                        <input
                          type="text"
                          value={baseUrl}
                          onChange={(e) => {
                            setBaseUrl(e.target.value);
                            setKeyVerified(null);
                            setVerifyError(null);
                          }}
                          placeholder="http://127.0.0.1:11434/v1"
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                          Local Model Name
                        </label>
                        <input
                          type="text"
                          value={customModel}
                          onChange={(e) => {
                            setCustomModel(e.target.value);
                            setKeyVerified(null);
                            setVerifyError(null);
                          }}
                          placeholder="llama3.2:latest"
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleTestApiKey}
                        disabled={testingKey}
                        className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {testingKey ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : keyVerified ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        <span>{testingKey ? "Testing..." : keyVerified ? "Verified" : "Test Local Connection"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedPreset.id !== "custom" && selectedPreset.id !== "ollama" && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-foreground">
                          {selectedPreset.name} API Key
                        </label>
                        <a
                          href={selectedPreset.helpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline"
                        >
                          Get an API key
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value);
                            setKeyVerified(null);
                            setVerifyError(null);
                          }}
                          placeholder={selectedPreset.placeholder}
                          className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={handleTestApiKey}
                          disabled={testingKey}
                          className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {testingKey ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : keyVerified ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Sparkles className="size-3.5" />
                          )}
                          <span>{testingKey ? "Testing..." : keyVerified ? "Verified" : "Test"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {verifyError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in-50">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
                  <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
                  <span>
                    Zero telemetry. Credentials & custom endpoints are saved locally on your computer with native AES-256 encryption.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: First Try Experience */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">Choose your starting experience</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Would you like to explore atTrack with realistic sample data or begin with a clean board?
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                {/* Option 1: Sample Data */}
                <div
                  onClick={() => setSeedDemoData(true)}
                  className={`flex flex-col justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    seedDemoData
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground">Explore with 3 Demo Jobs</span>
                      <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.2 rounded-sm">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pre-populates sample roles at Stripe, Linear, and Vercel with recruiters and interview stages so you can immediately see the board in action.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-primary font-medium">
                    <Check className="size-3.5" />
                    <span>Removable anytime in 1 click</span>
                  </div>
                </div>

                {/* Option 2: Clean Slate */}
                <div
                  onClick={() => setSeedDemoData(false)}
                  className={`flex flex-col justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    !seedDemoData
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground">Start Fresh</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Start with a clean, empty Kanban pipeline and add your own real job applications from scratch.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                    <Briefcase className="size-3.5" />
                    <span>Clean slate</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/10">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={submitting}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !isStep1Valid) {
                    setStep1Touched(true);
                    return;
                  }
                  setStep((s) => (s + 1) as Step);
                }}
                className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-lg shadow-xs"
              >
                <span>Continue</span>
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-brand text-primary-foreground transition-transform active:scale-95 px-5 py-2 rounded-lg shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Setting up workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Get started</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
