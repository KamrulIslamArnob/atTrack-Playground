"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, Save, ZoomIn, ZoomOut, Columns2, PenLine, Eye } from "lucide-react";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResumePreview } from "@/lib/resume/render-html";
import { exportResumeBuilderTex, saveResumeBuilderDocument } from "@/lib/actions/resume-builder";
import { DEFAULT_RESUME_APPEARANCE, type ResumeAppearance, type ResumeDoc } from "@/lib/types/resume-builder";
import { SectionAccordion } from "./interactive/section-accordion";
import { HeaderSectionEditor } from "./sections/header-section";
import { SubheadingSectionEditor } from "./sections/subheading-section";
import { ProjectSectionEditor } from "./sections/project-section";
import { SkillsSectionEditor } from "./sections/skills-section";
import { ClickToEditField } from "./interactive/click-to-edit-field";
import { ColorField } from "./interactive/color-field";
import { LiveRegion } from "./interactive/live-region";

interface ResumeBuilderEditorProps {
  id: string;
  initialName: string;
  initialDocument: ResumeDoc;
}

type ViewMode = "split" | "editor" | "preview";

export function ResumeBuilderEditor({ id, initialName, initialDocument }: ResumeBuilderEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [resume, setResume] = useState<ResumeDoc>(initialDocument);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Mark dirty on any change
  useEffect(() => {
    setDirty(true);
  }, [resume, name]);

  const updateHeader = useCallback((key: "name" | "title" | "summary", value: string) => {
    setResume((current) => ({ ...current, header: { ...current.header, [key]: value } }));
  }, []);

  const updateLinks = useCallback((group: "topLinks" | "bottomLinks", links: ResumeDoc["header"]["topLinks"]) => {
    setResume((current) => ({ ...current, header: { ...current.header, [group]: links } }));
  }, []);

  const updateAppearance = useCallback((appearance: ResumeAppearance) => {
    setResume((current) => ({ ...current, appearance }));
  }, []);

  const save = useCallback(async () => {
    setMessage(null);
    setIsPending(true);
    try {
      await saveResumeBuilderDocument(id, name, resume);
      setMessage("Saved");
      setDirty(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save resume.");
    } finally {
      setIsPending(false);
    }
  }, [id, name, resume, router]);

  const exportTex = useCallback(async () => {
    setMessage(null);
    setIsPending(true);
    try {
      await saveResumeBuilderDocument(id, name, resume);
      const result = await exportResumeBuilderTex(id);
      const blob = new Blob([result.tex], { type: "application/x-tex" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${result.name || "resume"}.tex`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("LaTeX source downloaded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to export LaTeX.");
    } finally {
      setIsPending(false);
    }
  }, [id, name, resume]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  // Beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  return (
    <div className="space-y-6">
      {/* Sticky top toolbar */}
      <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-3 sm:p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <ClickToEditField
              value={name}
              onChange={setName}
              placeholder="Document name…"
              ariaLabel="Document name"
              className="text-base font-semibold"
              displayClassName="text-base font-semibold"
            />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                "size-2 rounded-full transition-colors",
                isPending
                  ? "bg-primary animate-pulse"
                  : dirty
                  ? "bg-warning"
                  : "bg-success"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {isPending
                ? "Saving changes…"
                : dirty
                ? "Unsaved changes"
                : message || "All changes saved to SQLite"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Responsive View Mode Selector */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "editor"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Form Editor Only"
            >
              <PenLine className="size-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={cn(
                "hidden md:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "split"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Split View (Side-by-side)"
            >
              <Columns2 className="size-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Live Resume Preview"
            >
              <Eye className="size-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportTex}
              disabled={isPending}
              className="h-9 gap-1.5 px-3 text-xs font-medium cursor-pointer active:scale-[0.98]"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5 text-muted-foreground" />
              )}
              <span className="hidden sm:inline">Download</span> .tex
            </Button>

            <Link
              href={`/print/resume/${id}`}
              target="_blank"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "h-9 gap-1.5 px-3 text-xs font-medium cursor-pointer active:scale-[0.98]",
              })}
            >
              <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
              <span>Print / PDF</span>
            </Link>

            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={isPending || !dirty}
              className={cn(
                "h-9 gap-1.5 px-3.5 text-xs font-semibold text-primary-foreground bg-gradient-brand shadow-xs hover:opacity-95 active:scale-[0.97] transition-all cursor-pointer",
                (!dirty || isPending) && "opacity-60 cursor-not-allowed"
              )}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>Save</span>
            </Button>
          </div>
        </div>
      </div>

      {message && <p role="status" className="text-xs text-muted-foreground px-1">{message}</p>}

      {/* Main Content Layout */}
      {viewMode === "split" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start">
          <section aria-label="Resume editor" className="space-y-4 min-w-0">
            <EditorSections resume={resume} setResume={setResume} updateHeader={updateHeader} updateLinks={updateLinks} updateAppearance={updateAppearance} />
          </section>

          <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start" aria-label="Resume preview">
            <ResumePreviewScaler document={resume} />
          </aside>
        </div>
      )}

      {viewMode === "editor" && (
        <div className="max-w-4xl mx-auto w-full">
          <section aria-label="Resume editor" className="space-y-4">
            <EditorSections resume={resume} setResume={setResume} updateHeader={updateHeader} updateLinks={updateLinks} updateAppearance={updateAppearance} />
          </section>
        </div>
      )}

      {viewMode === "preview" && (
        <div className="max-w-5xl mx-auto w-full">
          <aside aria-label="Resume preview">
            <ResumePreviewScaler document={resume} />
          </aside>
        </div>
      )}

      <LiveRegion />
    </div>
  );
}

function EditorSections({
  resume,
  setResume,
  updateHeader,
  updateLinks,
  updateAppearance,
}: {
  resume: ResumeDoc;
  setResume: React.Dispatch<React.SetStateAction<ResumeDoc>>;
  updateHeader: (key: "name" | "title" | "summary", value: string) => void;
  updateLinks: (group: "topLinks" | "bottomLinks", links: ResumeDoc["header"]["topLinks"]) => void;
  updateAppearance: (appearance: ResumeAppearance) => void;
}) {
  return (
    <>
      <SectionAccordion title="Document and heading" defaultOpen>
        <HeaderSectionEditor
          name={resume.header.name}
          title={resume.header.title}
          summary={resume.header.summary}
          topLinks={resume.header.topLinks}
          bottomLinks={resume.header.bottomLinks}
          onUpdateName={(v) => updateHeader("name", v)}
          onUpdateTitle={(v) => updateHeader("title", v)}
          onUpdateSummary={(v) => updateHeader("summary", v)}
          onUpdateTopLinks={(links) => updateLinks("topLinks", links)}
          onUpdateBottomLinks={(links) => updateLinks("bottomLinks", links)}
        />
      </SectionAccordion>

      <SectionAccordion title="Resume appearance">
        <AppearanceEditor
          appearance={{ ...DEFAULT_RESUME_APPEARANCE, ...resume.appearance }}
          onChange={updateAppearance}
        />
      </SectionAccordion>

      <SectionAccordion title="Work experience" visible={resume.experience.visible} onToggleVisibility={() => setResume(r => ({ ...r, experience: { ...r.experience, visible: !r.experience.visible } }))}>
        <SubheadingSectionEditor
          title="Work experience"
          visible={resume.experience.visible}
          entries={resume.experience.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, experience: { visible, entries } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Education" visible={resume.education.visible} onToggleVisibility={() => setResume(r => ({ ...r, education: { ...r.education, visible: !r.education.visible } }))}>
        <SubheadingSectionEditor
          title="Education"
          visible={resume.education.visible}
          entries={resume.education.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, education: { visible, entries } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Skills" visible={resume.skills.visible} onToggleVisibility={() => setResume(r => ({ ...r, skills: { ...r.skills, visible: !r.skills.visible } }))}>
        <SkillsSectionEditor
          visible={resume.skills.visible}
          rows={resume.skills.rows}
          callout={resume.skills.callout}
          onChange={(rows, callout, visible) => setResume(r => ({ ...r, skills: { visible, rows, callout } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Projects" visible={resume.projects.visible} onToggleVisibility={() => setResume(r => ({ ...r, projects: { ...r.projects, visible: !r.projects.visible } }))}>
        <ProjectSectionEditor
          title="Projects"
          visible={resume.projects.visible}
          entries={resume.projects.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, projects: { visible, entries } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Professional training" visible={resume.training.visible} onToggleVisibility={() => setResume(r => ({ ...r, training: { ...r.training, visible: !r.training.visible } }))}>
        <ProjectSectionEditor
          title="Professional training"
          visible={resume.training.visible}
          entries={resume.training.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, training: { visible, entries } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Honors & awards" visible={resume.awards.visible} onToggleVisibility={() => setResume(r => ({ ...r, awards: { ...r.awards, visible: !r.awards.visible } }))}>
        <ProjectSectionEditor
          title="Honors & awards"
          visible={resume.awards.visible}
          entries={resume.awards.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, awards: { visible, entries } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Certifications" visible={resume.certifications.visible} onToggleVisibility={() => setResume(r => ({ ...r, certifications: { ...r.certifications, visible: !r.certifications.visible } }))}>
        <ProjectSectionEditor
          title="Certifications"
          visible={resume.certifications.visible}
          entries={resume.certifications.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, certifications: { visible, entries } }))}
        />
      </SectionAccordion>

      <SectionAccordion title="Leadership" visible={resume.leadership.visible} onToggleVisibility={() => setResume(r => ({ ...r, leadership: { ...r.leadership, visible: !r.leadership.visible } }))}>
        <ProjectSectionEditor
          title="Leadership"
          visible={resume.leadership.visible}
          entries={resume.leadership.entries}
          onChange={(entries, visible) => setResume(r => ({ ...r, leadership: { visible, entries } }))}
        />
      </SectionAccordion>
    </>
  );
}

function ResumePreviewScaler({ document }: { document: ResumeDoc }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [manualScale, setManualScale] = useState<number>(1);

  // Measure container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const letterWidth = 816; // 8.5in * 96dpi
  const letterHeight = 1056; // 11in * 96dpi

  const fitScale = containerWidth > 0 ? Math.min(1.2, Math.max(0.3, (containerWidth - 36) / letterWidth)) : 0.8;
  const currentScale = zoomMode === "fit" ? fitScale : manualScale;

  const handleZoomIn = () => {
    setZoomMode("manual");
    setManualScale((prev) => Math.min(1.5, Math.round((currentScale + 0.1) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoomMode("manual");
    setManualScale((prev) => Math.max(0.3, Math.round((currentScale - 0.1) * 10) / 10));
  };

  const handleFit = () => {
    setZoomMode("fit");
  };

  const handle100 = () => {
    setZoomMode("manual");
    setManualScale(1);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/80">
            Live Dual Preview
          </span>
          <span className="rounded-full bg-muted/80 border border-border/70 px-2 py-0.5 text-[10px] font-medium">
            Letter 8.5&quot; &times; 11&quot;
          </span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-card/90 backdrop-blur-xs border border-border/80 rounded-lg p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={currentScale <= 0.3}
            title="Zoom out"
            aria-label="Zoom out preview"
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ZoomOut className="size-3.5" />
          </button>

          <span className="min-w-10 text-center font-mono text-[11px] font-medium text-foreground select-none">
            {zoomMode === "fit" ? "Fit" : `${Math.round(currentScale * 100)}%`}
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={currentScale >= 1.5}
            title="Zoom in"
            aria-label="Zoom in preview"
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ZoomIn className="size-3.5" />
          </button>

          <div className="h-3.5 w-px bg-border/80 mx-0.5" />

          <button
            type="button"
            onClick={handleFit}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer",
              zoomMode === "fit" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Fit
          </button>

          <button
            type="button"
            onClick={handle100}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer",
              zoomMode === "manual" && manualScale === 1 ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            100%
          </button>
        </div>
      </div>

      {/* Preview Box */}
      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-2xl border border-border/80 bg-muted/30 p-3 sm:p-5 shadow-xs flex justify-center max-h-[calc(100vh-10rem)] min-h-[440px]"
      >
        <div
          style={{
            width: `${letterWidth * currentScale}px`,
            height: `${letterHeight * currentScale}px`,
            minWidth: `${letterWidth * currentScale}px`,
            minHeight: `${letterHeight * currentScale}px`,
            transition: "width 0.12s ease-out, height 0.12s ease-out",
          }}
          className="relative shrink-0 flex items-start justify-start"
        >
          <div
            style={{
              transform: `scale(${currentScale})`,
              transformOrigin: "top left",
              width: `${letterWidth}px`,
              minHeight: `${letterHeight}px`,
            }}
            className="shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] ring-1 ring-border/60 rounded-xs overflow-hidden"
          >
            <ResumePreview document={document} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceEditor({ appearance, onChange }: { appearance: ResumeAppearance; onChange: (appearance: ResumeAppearance) => void }) {
  const update = <K extends keyof ResumeAppearance>(key: K, value: ResumeAppearance[K]) => onChange({ ...appearance, [key]: value });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium text-foreground">Font family
          <select value={appearance.fontFamily} onChange={(e) => update("fontFamily", e.target.value)} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
            <option value='"Source Sans Pro", "Source Sans 3", Arial, sans-serif'>Source Sans Pro (LaTeX template)</option>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value='Georgia, "Times New Roman", serif'>Georgia</option>
            <option value='"Courier New", monospace'>Courier New</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-foreground">Base font size
          <input type="number" min="8" max="14" step="0.5" value={appearance.fontSize} onChange={(e) => update("fontSize", Number(e.target.value) || DEFAULT_RESUME_APPEARANCE.fontSize)} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label="Page background" value={appearance.pageColor} onChange={(v) => update("pageColor", v)} />
        <ColorField label="Main text" value={appearance.textColor} onChange={(v) => update("textColor", v)} />
        <ColorField label="Dark grey / section rules" value={appearance.mutedColor} onChange={(v) => update("mutedColor", v)} />
        <ColorField label="General border" value={appearance.borderColor} onChange={(v) => update("borderColor", v)} />
        <ColorField label="Orange accent" value={appearance.accentColor} onChange={(v) => update("accentColor", v)} />
        <ColorField label="Dark orange text and border" value={appearance.accentDarkColor} onChange={(v) => update("accentDarkColor", v)} />
        <ColorField label="Soft orange fill" value={appearance.softAccentColor} onChange={(v) => update("softAccentColor", v)} />
        <ColorField label="Portfolio fill" value={appearance.portfolioFillColor} onChange={(v) => update("portfolioFillColor", v)} />
        <ColorField label="Portfolio border" value={appearance.portfolioBorderColor} onChange={(v) => update("portfolioBorderColor", v)} />
        <ColorField label="Live-link fill" value={appearance.liveFillColor} onChange={(v) => update("liveFillColor", v)} />
        <ColorField label="Live-link border" value={appearance.liveBorderColor} onChange={(v) => update("liveBorderColor", v)} />
        <ColorField label="API-link fill" value={appearance.apiFillColor} onChange={(v) => update("apiFillColor", v)} />
        <ColorField label="API-link border" value={appearance.apiBorderColor} onChange={(v) => update("apiBorderColor", v)} />
      </div>
    </div>
  );
}
