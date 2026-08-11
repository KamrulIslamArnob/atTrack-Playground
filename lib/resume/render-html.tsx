import type { CSSProperties, ReactNode } from "react";

import { parseInline, type InlineNode } from "./inline.ts";
import {
  DEFAULT_RESUME_APPEARANCE,
  type ProjectEntry,
  type ResumeAppearance,
  type ResumeDoc,
  type ResumeLink,
  type SkillRow,
  type SubheadingEntry,
} from "../types/resume-builder.ts";

type ResolvedAppearance = ResumeAppearance;

function resolveAppearance(document: ResumeDoc): ResolvedAppearance {
  return { ...DEFAULT_RESUME_APPEARANCE, ...document.appearance };
}

function getPageStyle(appearance: ResolvedAppearance): CSSProperties {
  return {
    boxSizing: "border-box",
    width: "8.5in",
    minHeight: "11in",
    margin: "0 auto",
    padding: "0.48in 0.58in",
    background: appearance.pageColor,
    color: appearance.textColor,
    fontFamily: appearance.fontFamily,
    fontSize: `${appearance.fontSize}pt`,
    lineHeight: 1.35,
  };
}

const badgeLabels: Record<string, string> = {
  live: "Live",
  repo: "Repository",
  api: "API",
  cred: "Credential",
  port: "Portfolio",
};

function InlineText({ value }: { value: string }): ReactNode {
  return value.split("\n").map((line, index) => (
    <span key={index}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

/** Renders the shared inline grammar so preview and TeX export stay in sync. */
export function ResumeInline({ nodes, appearance = DEFAULT_RESUME_APPEARANCE }: { nodes: InlineNode[]; appearance?: ResolvedAppearance }): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;

    switch (node.type) {
      case "text":
        return <InlineText key={key} value={node.value} />;
      case "bold":
        return <strong key={key} className="resume-inline-bold"><ResumeInline nodes={node.children} appearance={appearance} /></strong>;
      case "italic":
        return <em key={key} className="resume-inline-italic"><ResumeInline nodes={node.children} appearance={appearance} /></em>;
      case "sep":
        return <span key={key} className="resume-inline-separator" aria-hidden="true"> · </span>;
      case "badge": {
        const isChip = node.kind === "cat" || node.kind === "type";
        const label = node.label || (isChip ? "" : badgeLabels[node.kind] ?? node.kind);
        const pill = (
          <span
            className={`resume-${isChip ? "chip" : "badge"} resume-${node.kind}`}
            title={isChip ? node.kind : badgeLabels[node.kind] ?? node.kind}
            style={{
              display: "inline-block",
              marginLeft: "0.2em",
              padding: isChip ? "0.03em 0.42em" : "0.06em 0.48em",
              border: node.kind === "cat" ? "none" : `1px solid ${node.kind === "type" ? appearance.mutedColor : node.kind === "port" ? appearance.portfolioBorderColor : node.kind === "live" ? appearance.liveBorderColor : node.kind === "api" ? appearance.apiBorderColor : appearance.accentDarkColor}`,
              borderRadius: "4px",
              background: node.kind === "cat" ? appearance.softAccentColor : node.kind === "type" ? "transparent" : node.kind === "port" ? appearance.portfolioFillColor : node.kind === "live" ? appearance.liveFillColor : node.kind === "api" ? appearance.apiFillColor : appearance.softAccentColor,
              color: node.kind === "cat" ? appearance.accentDarkColor : node.kind === "type" ? appearance.mutedColor : node.kind === "port" ? appearance.portfolioBorderColor : node.kind === "live" ? appearance.liveBorderColor : node.kind === "api" ? appearance.apiBorderColor : appearance.accentDarkColor,
              fontSize: "0.78em",
              fontStyle: "normal",
              fontWeight: 600,
              letterSpacing: "0.01em",
              lineHeight: 1.25,
              verticalAlign: "0.08em",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        );
        return node.url ? (
          <a key={key} className="resume-inline-badge-link" href={node.url} target="_blank" rel="noreferrer">
            {pill}
          </a>
        ) : <span key={key}>{pill}</span>;
      }
    }
  });
}

function Inline({ value, appearance }: { value: string; appearance: ResolvedAppearance }) {
  return <ResumeInline nodes={parseInline(value)} appearance={appearance} />;
}

function HeaderLink({ link, appearance }: { link: ResumeLink; appearance: ResolvedAppearance }) {
  const content = <span className="resume-header-link-label">{link.label}</span>;
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.2em 0.62em",
    border: link.variant === "port" ? `1px solid ${appearance.portfolioBorderColor}` : "none",
    borderRadius: link.variant === "port" ? "4px" : "5px",
    background: link.variant === "port" ? appearance.portfolioFillColor : appearance.softAccentColor,
    color: link.variant === "port" ? appearance.portfolioBorderColor : appearance.mutedColor,
    fontSize: "8.5pt",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  return link.url ? (
    <a className={`resume-header-pill resume-header-pill-${link.variant}`} style={style} href={link.url} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : <span className={`resume-header-pill resume-header-pill-${link.variant}`} style={style}>{content}</span>;
}

function Section({ title, children, appearance }: { title: string; children: ReactNode; appearance: ResolvedAppearance }) {
  return (
    <section className="resume-section" style={{ marginTop: "0.18in" }}>
      <div className="resume-section-heading" style={{ display: "flex", alignItems: "center", gap: "0.55em", marginBottom: "0.06in" }}>
        <h2 style={{ margin: 0, color: appearance.textColor, fontSize: "9.5pt", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</h2>
        <div className="resume-section-rule" style={{ flex: 1, borderTop: `1px solid ${appearance.borderColor}` }} />
      </div>
      {children}
    </section>
  );
}

function BulletList({ bullets, appearance }: { bullets: string[]; appearance: ResolvedAppearance }) {
  if (bullets.length === 0) return null;
  return (
    <ul className="resume-bullet-list" style={{ margin: "0.025in 0 0.03in", paddingLeft: "0.19in" }}>
      {bullets.map((bullet, index) => (
        <li key={index} className="resume-bullet" style={{ paddingLeft: "0.035in", marginBottom: "0.012in" }}><Inline value={bullet} appearance={appearance} /></li>
      ))}
    </ul>
  );
}

function Subheading({ entry, appearance }: { entry: SubheadingEntry; appearance: ResolvedAppearance }) {
  return (
    <article className="resume-subheading" style={{ marginTop: "0.065in" }}>
      <div className="resume-subheading-row resume-subheading-primary" style={{ display: "flex", justifyContent: "space-between", gap: "0.25in" }}>
        <strong>{entry.left1}</strong>
        <strong style={{ color: appearance.mutedColor, textAlign: "right" }}><Inline value={entry.right1} appearance={appearance} /></strong>
      </div>
      <div className="resume-subheading-row resume-subheading-secondary" style={{ display: "flex", justifyContent: "space-between", gap: "0.25in", fontSize: "9.25pt" }}>
        <em>{entry.left2}</em>
        <em style={{ textAlign: "right", whiteSpace: "nowrap" }}>{entry.right2}</em>
      </div>
      <BulletList bullets={entry.bullets} appearance={appearance} />
    </article>
  );
}

function Project({ entry, appearance }: { entry: ProjectEntry; appearance: ResolvedAppearance }) {
  return (
    <article className="resume-project" style={{ marginTop: "0.06in" }}>
      <div className="resume-project-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.2in" }}>
        <span className="resume-project-left"><Inline value={entry.left} appearance={appearance} /></span>
        {entry.right ? <span className="resume-project-right" style={{ textAlign: "right", whiteSpace: "nowrap" }}><Inline value={entry.right} appearance={appearance} /></span> : null}
      </div>
      {entry.note ? <p className="resume-project-note" style={{ margin: "0.025in 0 0", fontSize: "9.25pt" }}><Inline value={entry.note} appearance={appearance} /></p> : null}
      <BulletList bullets={entry.bullets} appearance={appearance} />
    </article>
  );
}

function Skills({ rows, callout, appearance }: { rows: SkillRow[]; callout: string; appearance: ResolvedAppearance }) {
  return (
    <>
      <div className="resume-skills-grid">
        {rows.map((row) => (
          <div key={row.id} className="resume-skill-row" style={{ display: "grid", gridTemplateColumns: "1.6in 1fr", gap: "0.08in", marginBottom: "0.025in" }}>
            <strong className="resume-skill-label">{row.label}:</strong>
            <span className="resume-skill-value"><Inline value={row.value} appearance={appearance} /></span>
          </div>
        ))}
      </div>
      {callout ? (
        <aside className="resume-ai-callout" style={{ marginTop: "0.06in", padding: "0.055in 0.09in", borderLeft: `3px solid ${appearance.accentColor}`, background: appearance.softAccentColor, fontSize: "9.25pt" }}>
          <Inline value={callout} appearance={appearance} />
        </aside>
      ) : null}
    </>
  );
}

/** Letter-sized resume preview. Consumer CSS can target the resume-* class names. */
export function ResumePreview({ document }: { document: ResumeDoc }) {
  const { header } = document;
  const appearance = resolveAppearance(document);

  return (
    <article className="resume-preview" style={getPageStyle(appearance)} aria-label={`${header.name} resume`}>
      <header className="resume-header">
        <div className="resume-header-row resume-header-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.2in" }}>
          <h1 className="resume-name" style={{ margin: 0, color: appearance.accentColor, fontSize: "24pt", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>{header.name}</h1>
          <div className="resume-header-links resume-header-top-links" style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.045in" }}>
            {header.topLinks.map((link) => <HeaderLink key={link.id} link={link} appearance={appearance} />)}
          </div>
        </div>
        <div className="resume-header-row resume-header-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.2in", marginTop: "0.05in" }}>
          <p className="resume-title" style={{ margin: 0, fontSize: "12pt", fontWeight: 600 }}>{header.title}</p>
          <div className="resume-header-links resume-header-bottom-links" style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.045in" }}>
            {header.bottomLinks.map((link) => <HeaderLink key={link.id} link={link} appearance={appearance} />)}
          </div>
        </div>
        <p className="resume-summary" style={{ margin: "0.075in 0 0", fontSize: "9.5pt" }}>{header.summary}</p>
      </header>

      {document.experience.visible ? <Section title="Work Experience" appearance={appearance}>{document.experience.entries.map((entry) => <Subheading key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
      {document.skills.visible ? <Section title="Skills" appearance={appearance}><Skills rows={document.skills.rows} callout={document.skills.callout} appearance={appearance} /></Section> : null}
      {document.projects.visible ? <Section title="Projects" appearance={appearance}>{document.projects.entries.map((entry) => <Project key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
      {document.education.visible ? <Section title="Education" appearance={appearance}>{document.education.entries.map((entry) => <Subheading key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
      {document.training.visible ? <Section title="Professional Training" appearance={appearance}>{document.training.entries.map((entry) => <Project key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
      {document.awards.visible ? <Section title="Honors & Awards" appearance={appearance}>{document.awards.entries.map((entry) => <Project key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
      {document.certifications.visible ? <Section title="Certifications" appearance={appearance}>{document.certifications.entries.map((entry) => <Project key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
      {document.leadership.visible ? <Section title="Leadership" appearance={appearance}>{document.leadership.entries.map((entry) => <Project key={entry.id} entry={entry} appearance={appearance} />)}</Section> : null}
    </article>
  );
}
