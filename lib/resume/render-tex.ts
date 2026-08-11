import { parseInline, type InlineNode } from "./inline.ts";
import type {
  ProjectEntry,
  ResumeDoc,
  ResumeLink,
  SkillRow,
  SubheadingEntry,
} from "../types/resume-builder.ts";

type ResumeAppearance = {
  fontFamily?: string;
  fontSize?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  accentDarkColor?: string;
  pageColor?: string;
  softAccentColor?: string;
  portfolioFillColor?: string;
  portfolioBorderColor?: string;
  liveFillColor?: string;
  liveBorderColor?: string;
  apiFillColor?: string;
  apiBorderColor?: string;
  borderColor?: string;
};

type ThemedResumeDoc = ResumeDoc & { appearance?: ResumeAppearance };
type ResolvedAppearance = Required<ResumeAppearance>;

const defaultAppearance: ResolvedAppearance = {
  fontFamily: "Source Sans Pro",
  fontSize: "10pt",
  textColor: "#000000",
  mutedColor: "#333333",
  accentColor: "#FF6600",
  accentDarkColor: "#CC5200",
  pageColor: "#FFFFFF",
  softAccentColor: "#FFF8F2",
  portfolioFillColor: "#FFE0CC",
  portfolioBorderColor: "#B34700",
  liveFillColor: "#E8F5E9",
  liveBorderColor: "#2E7D32",
  apiFillColor: "#F3E5F5",
  apiBorderColor: "#6A1B9A",
  borderColor: "#333333",
};

function resolveAppearance(document: ResumeDoc): ResolvedAppearance {
  return { ...defaultAppearance, ...(document as ThemedResumeDoc).appearance };
}

function texColor(value: string, fallback: string): string {
  const hex = value.replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : fallback;
}

function texFontFamily(value: string): string {
  const primary = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  return /^[A-Za-z0-9 .-]+$/.test(primary) ? primary : defaultAppearance.fontFamily;
}

function texFontSize(value: string): string {
  return /^\d+(?:\.\d+)?pt$/.test(value) ? value : defaultAppearance.fontSize;
}

/** Escape arbitrary resume content before it is placed in a TeX text argument. */
function escapeTex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/[\r\n]+/g, " ");
}

/** A URL needs the same protection: never interpolate unescaped user input into TeX. */
function escapeTexUrl(url: string): string {
  return escapeTex(url).replace(/ /g, "%20");
}

function renderInlineNodes(nodes: InlineNode[], appearance: ResolvedAppearance): string {
  return nodes.map((node) => {
    switch (node.type) {
      case "text":
        return escapeTex(node.value);
      case "bold":
        return `\\textbf{${renderInlineNodes(node.children, appearance)}}`;
      case "italic":
        return `\\textit{${renderInlineNodes(node.children, appearance)}}`;
      case "sep":
        return " {\\color{ResumeMuted}\\textperiodcentered} ";
      case "badge": {
        const isChip = node.kind === "cat" || node.kind === "type";
        const macro = isChip ? "\\resumeChip" : node.kind === "port" ? "\\resumePortfolioBadge" : node.kind === "live" ? "\\resumeLiveBadge" : node.kind === "api" ? "\\resumeApiBadge" : "\\resumeOrangeBadge";
        const pill = `${macro}{${escapeTex(node.label)}}`;
        return node.url ? `\\href{${escapeTexUrl(node.url)}}{${pill}}` : pill;
      }
    }
  }).join("");
}

function renderInline(value: string, appearance: ResolvedAppearance): string {
  return renderInlineNodes(parseInline(value), appearance);
}

function renderHeaderLink(link: ResumeLink): string {
  const macro = link.variant === "port" ? "\\portbtn" : "\\contactbtn";
  const pill = `${macro}{${escapeTex(link.label)}}`;
  return link.url ? `\\href{${escapeTexUrl(link.url)}}{${pill}}` : pill;
}

function renderBullets(bullets: string[], appearance: ResolvedAppearance): string {
  if (bullets.length === 0) return "";
  return `\\begin{itemize}\n${bullets.map((bullet) => `  \\resumeItem{${renderInline(bullet, appearance)}}`).join("\n")}\n\\end{itemize}\n`;
}

function renderSubheading(entry: SubheadingEntry, appearance: ResolvedAppearance): string {
  return [
    `\\resumeSubheading{${escapeTex(entry.left1)}}{${renderInline(entry.right1, appearance)}}{${escapeTex(entry.left2)}}{${escapeTex(entry.right2)}}`,
    renderBullets(entry.bullets, appearance).trimEnd(),
  ].filter(Boolean).join("\n");
}

function renderProject(entry: ProjectEntry, appearance: ResolvedAppearance): string {
  const lines = [`\\resumeProjectHeading{${renderInline(entry.left, appearance)}}{${renderInline(entry.right, appearance)}}`];
  if (entry.note) lines.push(`\\resumeProjectNote{${renderInline(entry.note, appearance)}}`);
  const bullets = renderBullets(entry.bullets, appearance).trimEnd();
  if (bullets) lines.push(bullets);
  return lines.join("\n");
}

function renderSkills(rows: SkillRow[], callout: string, appearance: ResolvedAppearance): string {
  const body = rows.map((row) => `\\resumeSkillRow{${escapeTex(row.label)}}{${renderInline(row.value, appearance)}}`).join("\n");
  return callout ? `${body}\n\\resumeAICallout{${renderInline(callout, appearance)}}` : body;
}

function renderSection(title: string, content: string): string {
  return `\\resumeSection{${title}}\n${content}`;
}

/**
 * Emits a complete Letter-sized XeLaTeX/LuaLaTeX document. The renderer uses
 * the shared inline parser, rather than a second markup implementation, so
 * screen preview and exported TeX preserve the same bold, italic, separators,
 * badges, and chips.
 */
export function renderResumeTex(doc: ResumeDoc): string {
  const appearance = resolveAppearance(doc);
  const sections: string[] = [];

  if (doc.experience.visible) sections.push(renderSection("Work Experience", doc.experience.entries.map((entry) => renderSubheading(entry, appearance)).join("\n\n")));
  if (doc.skills.visible) sections.push(renderSection("Skills", renderSkills(doc.skills.rows, doc.skills.callout, appearance)));
  if (doc.projects.visible) sections.push(renderSection("Projects", doc.projects.entries.map((entry) => renderProject(entry, appearance)).join("\n\n")));
  if (doc.education.visible) sections.push(renderSection("Education", doc.education.entries.map((entry) => renderSubheading(entry, appearance)).join("\n\n")));
  if (doc.training.visible) sections.push(renderSection("Professional Training", doc.training.entries.map((entry) => renderProject(entry, appearance)).join("\n\n")));
  if (doc.awards.visible) sections.push(renderSection("Honors & Awards", doc.awards.entries.map((entry) => renderProject(entry, appearance)).join("\n\n")));
  if (doc.certifications.visible) sections.push(renderSection("Certifications", doc.certifications.entries.map((entry) => renderProject(entry, appearance)).join("\n\n")));
  if (doc.leadership.visible) sections.push(renderSection("Leadership", doc.leadership.entries.map((entry) => renderProject(entry, appearance)).join("\n\n")));

  const header = doc.header;
  const fontFamily = texFontFamily(appearance.fontFamily);
  const fontSize = texFontSize(appearance.fontSize);
  const colors = {
    text: texColor(appearance.textColor, "000000"),
    muted: texColor(appearance.mutedColor, "333333"),
    accent: texColor(appearance.accentColor, "FF6600"),
    accentDark: texColor(appearance.accentDarkColor, "CC5200"),
    page: texColor(appearance.pageColor, "FFFFFF"),
    softAccent: texColor(appearance.softAccentColor, "FFF8F2"),
    portfolioFill: texColor(appearance.portfolioFillColor, "FFE0CC"),
    portfolioBorder: texColor(appearance.portfolioBorderColor, "B34700"),
    liveFill: texColor(appearance.liveFillColor, "E8F5E9"),
    liveBorder: texColor(appearance.liveBorderColor, "2E7D32"),
    apiFill: texColor(appearance.apiFillColor, "F3E5F5"),
    apiBorder: texColor(appearance.apiBorderColor, "6A1B9A"),
    border: texColor(appearance.borderColor, "333333"),
  };
  const topLinks = header.topLinks.map(renderHeaderLink).join("\\hspace{0.35em}");
  const bottomLinks = header.bottomLinks.map(renderHeaderLink).join("\\hspace{0.35em}");

  return String.raw`% !TEX program = xelatex
% Generated by renderResumeTex. Compile with XeLaTeX or LuaLaTeX.
\documentclass[${fontSize},letterpaper]{article}
\usepackage[letterpaper,margin=0.58in,top=0.48in,bottom=0.48in]{geometry}
\usepackage{fontspec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage{tabularx}
\usepackage{hyperref}
\usepackage{titlesec}
\usepackage{ragged2e}
\pagestyle{empty}
\setmainfont{${fontFamily}}[Fallback={Arial}]
\definecolor{ResumeText}{HTML}{${colors.text}}
\definecolor{ResumeMuted}{HTML}{${colors.muted}}
\definecolor{ResumeAccent}{HTML}{${colors.accent}}
\definecolor{ResumeAccentDark}{HTML}{${colors.accentDark}}
\definecolor{ResumePage}{HTML}{${colors.page}}
\definecolor{ResumeSoftAccent}{HTML}{${colors.softAccent}}
\definecolor{ResumePortfolioFill}{HTML}{${colors.portfolioFill}}
\definecolor{ResumePortfolioBorder}{HTML}{${colors.portfolioBorder}}
\definecolor{ResumeLiveFill}{HTML}{${colors.liveFill}}
\definecolor{ResumeLiveBorder}{HTML}{${colors.liveBorder}}
\definecolor{ResumeApiFill}{HTML}{${colors.apiFill}}
\definecolor{ResumeApiBorder}{HTML}{${colors.apiBorder}}
\definecolor{ResumeBorder}{HTML}{${colors.border}}
\hypersetup{colorlinks=true,urlcolor=ResumeAccent,pdfborder={0 0 0}}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\setlist[itemize]{leftmargin=0.19in,label=\textbullet,itemsep=0.08em,topsep=0.12em,parsep=0pt,partopsep=0pt}
\newcommand{\resumeSection}[1]{\vspace{0.68em}\noindent\textbf{\MakeUppercase{\small #1}}\hspace{0.55em}\leaders\hrule height 0.4pt\hfill\kern0pt\\[-0.25em]}
\newcommand{\portbtn}[1]{\begingroup\setlength{\fboxsep}{0.35em}\fcolorbox{ResumePortfolioBorder}{ResumePortfolioFill}{\color{ResumePortfolioBorder}\scriptsize\textbf{#1}}\endgroup}
\newcommand{\contactbtn}[1]{\begingroup\setlength{\fboxsep}{0.32em}\fcolorbox{ResumeBorder}{ResumePage}{\color{ResumeText}\scriptsize\textbf{#1}}\endgroup}
\newcommand{\resumeOrangeBadge}[1]{\begingroup\setlength{\fboxsep}{0.28em}\fcolorbox{ResumeAccentDark}{ResumeSoftAccent}{\color{ResumeAccentDark}\scriptsize\textbf{#1}}\endgroup}
\newcommand{\resumePortfolioBadge}[1]{\begingroup\setlength{\fboxsep}{0.28em}\fcolorbox{ResumePortfolioBorder}{ResumePortfolioFill}{\color{ResumePortfolioBorder}\scriptsize\textbf{#1}}\endgroup}
\newcommand{\resumeLiveBadge}[1]{\begingroup\setlength{\fboxsep}{0.28em}\fcolorbox{ResumeLiveBorder}{ResumeLiveFill}{\color{ResumeLiveBorder}\scriptsize\textbf{#1}}\endgroup}
\newcommand{\resumeApiBadge}[1]{\begingroup\setlength{\fboxsep}{0.28em}\fcolorbox{ResumeApiBorder}{ResumeApiFill}{\color{ResumeApiBorder}\scriptsize\textbf{#1}}\endgroup}
\newcommand{\resumeChip}[1]{\begingroup\setlength{\fboxsep}{0.22em}\fcolorbox{ResumeBorder}{ResumePage}{\scriptsize #1}\endgroup}
\newcommand{\resumeSubheading}[4]{\vspace{0.35em}\noindent\begin{tabular*}{\textwidth}{@{}l@{\extracolsep{\fill}}r@{}}\textbf{#1} & \textbf{\color{ResumeMuted}#2}\\[-0.1em]\textit{\small #3} & \textit{\small #4}\end{tabular*}}
\newcommand{\resumeProjectHeading}[2]{\vspace{0.32em}\noindent\begin{tabular*}{\textwidth}{@{}p{0.73\textwidth}@{\extracolsep{\fill}}r@{}}#1 & #2\end{tabular*}}
\newcommand{\resumeProjectNote}[1]{\noindent\small #1\par}
\newcommand{\resumeItem}[1]{\item \small #1}
\newcommand{\resumeSkillRow}[2]{\noindent\begin{tabular*}{\textwidth}{@{}p{1.6in}@{\hspace{0.08in}}p{\dimexpr\textwidth-1.68in\relax}@{}}\textbf{#1:} & #2\end{tabular*}\\[-0.1em]}
\newcommand{\resumeAICallout}[1]{\vspace{0.3em}\noindent\colorbox{ResumeSoftAccent}{\parbox{\dimexpr\textwidth-0.18in\relax}{\small\color{ResumeText}\rule{0pt}{1.1em}\hspace{0.06in}\textcolor{ResumeAccent}{\rule{2pt}{1.15em}}\hspace{0.07in}#1}}\par}
\begin{document}
\pagecolor{ResumePage}
\color{ResumeText}
\begin{tabular*}{\textwidth}{@{}l@{\extracolsep{\fill}}r@{}}
{\fontsize{24}{26}\selectfont\textbf{\color{ResumeAccent}${escapeTex(header.name)}}} & ${topLinks}\\[0.35em]
{\large\textbf{${escapeTex(header.title)}}} & ${bottomLinks}
\end{tabular*}

\vspace{0.4em}\noindent\small ${escapeTex(header.summary)}

${sections.join("\n\n")}
\end{document}
`;
}
