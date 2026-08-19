"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { testProviderConnection, fetchProviderModels, type FetchedModel } from "@/lib/actions/ai-providers";
import { saveAvatar } from "@/lib/actions/auth";
import { extractTextFromPDF } from "@/lib/utils/pdf-extract";
import {
  ALL_AI_PRESETS,
  AI_PRESET_CATEGORIES,
  type AiPreset,
  type PresetCategory,
  type ProviderType,
} from "@/lib/types/ai-providers";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Briefcase,
  FileText,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Upload,
  Bot,
  Layers,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Camera,
  Search,
  RefreshCw,
  Plug,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface OnboardingWizardProps {
  isOpen: boolean;
  profileName?: string | null;
  userEmail?: string | null;
  initialAvatarUrl?: string | null;
  onFinished?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({
  isOpen,
  profileName,
  userEmail,
  initialAvatarUrl,
  onFinished,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(isOpen);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  const isPlaceholderEmail = (value: string) => value.trim().toLowerCase().endsWith("@attrack.local");

  // Step 1: Profile & Target Role
  const [fullName, setFullName] = useState(profileName || "");
  const [email, setEmail] = useState(userEmail && !isPlaceholderEmail(userEmail) ? userEmail : "");
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
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>("major");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState("gemini-2.5-flash");
  const [baseUrl, setBaseUrl] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [keyVerified, setKeyVerified] = useState<boolean | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Dynamic model fetching state
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [onlyFreeModels, setOnlyFreeModels] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Step 4: First Try / Seed Data
  const [seedDemoData, setSeedDemoData] = useState(true);

  const selectedPreset: AiPreset =
    ALL_AI_PRESETS.find((p) => p.id === selectedPresetId) ?? ALL_AI_PRESETS[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarJustUploaded, setAvatarJustUploaded] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const validExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      toast.error("Please select a JPG, PNG, GIF, WebP, or SVG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);

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

  const isLocalEndpoint =
    selectedPreset.isLocal ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("0.0.0.0") ||
    baseUrl.includes("11434") ||
    baseUrl.includes("1234");

  const handleSelectPreset = (preset: AiPreset) => {
    setSelectedPresetId(preset.id);
    setKeyVerified(null);
    setVerifyError(null);
    setFetchedModels([]);
    setShowModelPicker(false);
    setBaseUrl(preset.defaultBaseUrl || (preset.providerType === "openai_compatible" ? "https://api.openai.com/v1" : ""));
    setCustomModel(preset.defaultModel);
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetchProviderModels({
        provider_type: selectedPreset.providerType,
        base_url: selectedPreset.providerType === "openai_compatible" ? (baseUrl || selectedPreset.defaultBaseUrl) : undefined,
        api_key: apiKey.trim() || (isLocalEndpoint ? "local" : undefined),
      });

      if (res.models && res.models.length > 0) {
        setFetchedModels(res.models);
        setShowModelPicker(true);
        const freeCount = res.models.filter((m) => m.isFree).length;
        if (freeCount > 0) {
          toast.success(`Fetched ${res.models.length} models (${freeCount} free)`);
        } else {
          toast.success(`Fetched ${res.models.length} models`);
        }
      } else {
        toast.error(res.error || "Could not fetch models.");
      }
    } catch {
      toast.error("Could not fetch models.");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestApiKey = async () => {
    const key = apiKey.trim();

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
        api_key: key || (isLocalEndpoint ? "local" : undefined),
        base_url: urlToTest,
      });

      if (res.success) {
        setKeyVerified(true);
        toast.success(
          res.latencyMs
            ? `Connection verified (${res.latencyMs}ms)`
            : "Connection verified successfully"
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
      const hasAi =
        Boolean(apiKey.trim()) ||
        isLocalEndpoint ||
        selectedPreset.providerType === "gemini" ||
        Boolean(baseUrl.trim());

      const aiPayload = hasAi
        ? {
            name: selectedPreset.name,
            providerType: selectedPreset.providerType,
            apiKey: apiKey.trim() || (isLocalEndpoint ? "local" : ""),
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
      const res = await completeOnboarding({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
        experienceLevel,
      });
      if (res.success) {
        toast.info("Skipped setup");
        setOpen(false);
        onFinished?.();
        router.refresh();
      } else {
        toast.error(res.error || "Couldn't skip setup");
      }
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
                    <AnimatePresence>
                      {avatarPreview ? (
                        <motion.img
                          key="photo"
                          src={avatarPreview}
                          alt="Your avatar"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className="size-full object-cover"
                          onError={() => setAvatarPreview(null)}
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
                    title="Upload profile photo"
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
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Profile photo</p>
                  <p className="text-[11px] text-muted-foreground">Optional — JPG, PNG, GIF or WebP, max 500KB</p>
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
                  Bring your own API key or connect custom API endpoints (OpenAI, Gemini, Claude, Groq, Ollama, DeepSeek, OpenRouter). Keys stay encrypted locally.
                </p>
              </div>

              {/* Category Selector Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-2">
                {AI_PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      selectedCategory === cat.id
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Provider Selection Cards for Active Category */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_AI_PRESETS.filter((p) => p.category === selectedCategory).map((p) => {
                  const isSelected = selectedPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                          : "border-border bg-card text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span className="flex w-full items-start justify-between gap-1.5">
                        <span className="truncate text-xs font-semibold leading-tight">
                          {p.name}
                        </span>
                        {p.badge && (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.2 text-[9px] font-medium leading-none ${
                              p.badge === "Free tier" || p.badge === "Local"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {p.badge}
                          </span>
                        )}
                      </span>
                      <span className="truncate w-full text-[10px] leading-tight text-muted-foreground font-mono">
                        {p.defaultModel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Configuration Form in Exact Sequence */}
              <div className="space-y-3 pt-1">
                {/* 1. API Key (optional for local endpoints) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-foreground">
                      API Key {isLocalEndpoint && <span className="text-muted-foreground font-normal">(Optional for local endpoints)</span>}
                    </label>
                    {selectedPreset.helpUrl && (
                      <a
                        href={selectedPreset.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <span>Get an API key</span>
                        <ChevronRight className="size-3" />
                      </a>
                    )}
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
                      placeholder={isLocalEndpoint ? "local (optional)" : selectedPreset.placeholder}
                      className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleTestApiKey}
                      disabled={testingKey}
                      className="h-9 px-3 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {testingKey ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : keyVerified ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Plug className="size-3.5" />
                      )}
                      <span>{testingKey ? "Testing..." : keyVerified ? "Verified" : "Test"}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Base URL / API Endpoint */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Base URL / API Endpoint {selectedPreset.providerType === "openai_compatible" && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setKeyVerified(null);
                      setVerifyError(null);
                      setFetchedModels([]);
                      setShowModelPicker(false);
                    }}
                    placeholder={selectedPreset.defaultBaseUrl || "https://api.openai.com/v1"}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* 3. Model Selection (Dynamic Fetch) */}
                <div className="relative" ref={modelPickerRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-foreground">
                      Model Selection <span className="text-destructive">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={isFetchingModels}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {isFetchingModels ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                      <span>Fetch Models</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => {
                        setCustomModel(e.target.value);
                        setKeyVerified(null);
                        setVerifyError(null);
                      }}
                      onFocus={() => {
                        if (fetchedModels.length > 0) setShowModelPicker(true);
                      }}
                      placeholder="e.g. gpt-4o-mini, gemini-2.5-flash, deepseek-chat"
                      className="w-full h-9 pr-8 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
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
                      title="Toggle model dropdown"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  {/* Searchable Model Picker Dropdown */}
                  {showModelPicker && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 rounded-xl border border-border bg-card p-2 shadow-xl space-y-2 animate-in fade-in-50">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder="Filter models..."
                            className="w-full rounded-lg border border-border bg-background py-1 pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        {fetchedModels.some((m) => m.isFree) && (
                          <button
                            type="button"
                            onClick={() => setOnlyFreeModels(!onlyFreeModels)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                              onlyFreeModels
                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            Free Only
                          </button>
                        )}
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {fetchedModels
                          .filter((m) => {
                            if (onlyFreeModels && !m.isFree) return false;
                            if (!modelSearch.trim()) return true;
                            const query = modelSearch.toLowerCase();
                            return m.id.toLowerCase().includes(query) || (m.name && m.name.toLowerCase().includes(query));
                          })
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setCustomModel(m.id);
                                setShowModelPicker(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted hover:text-foreground cursor-pointer ${
                                customModel === m.id ? "bg-muted font-medium text-foreground" : "text-foreground"
                              }`}
                            >
                              <div className="truncate max-w-[280px]">
                                <span className="font-mono text-foreground">{m.id}</span>
                                {m.name && m.name !== m.id && (
                                  <span className="ml-1 text-[11px] text-muted-foreground truncate block">
                                    {m.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {m.isFree && (
                                  <span className="border border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold px-1 py-0.2 rounded-md">
                                    FREE
                                  </span>
                                )}
                                {m.contextLength && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {Math.round(m.contextLength / 1024)}k
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

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
