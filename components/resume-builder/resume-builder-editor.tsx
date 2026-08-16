"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, Save } from "lucide-react";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { Button, buttonVariants } from "@/components/ui/button";
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

export function ResumeBuilderEditor({ id, initialName, initialDocument }: ResumeBuilderEditorProps) {
  const router = useRouter();

  // For simplicity, use local state management. In production, use the reducer pattern.
  const [name, setName] = useState(initialName);
  const [resume, setResume] = useState<ResumeDoc>(initialDocument);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [dirty, setDirty] = useState(false);

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
    <div className="space-y-5">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <ClickToEditField
            value={name}
            onChange={setName}
            placeholder="Document name…"
            ariaLabel="Document name"
            className="text-sm font-medium"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {dirty ? "Unsaved changes" : message || "Saved"} {isPending && "• Saving…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportTex} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download .tex
          </Button>
          <Link href={`/print/resume/${id}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
            <ExternalLinkIcon className="size-4" /> Print / Save PDF
          </Link>
          <Button type="button" onClick={save} disabled={isPending || !dirty}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save resume
          </Button>
        </div>
      </div>

      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}

      {/* Two-pane layout */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(620px,1.1fr)]">
        {/* Editor pane */}
        <section aria-label="Resume editor" className="space-y-3">
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
        </section>

        {/* Preview pane */}
        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Resume preview">
          <div className="overflow-auto rounded-2xl border border-border bg-muted/40 p-3">
            <ResumePreview document={resume} />
          </div>
        </aside>
      </div>

      <LiveRegion />
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

// Missing imports removed
