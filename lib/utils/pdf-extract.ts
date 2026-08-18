"use client";

import * as pdfjsLib from "pdfjs-dist";

// Served from public/, not a CDN: atTrack is an offline desktop app, and a remote
// worker meant PDF text extraction failed with no internet. scripts/copy-pdf-worker.js
// refreshes this file from node_modules on every install, so it always matches the
// resolved pdfjs-dist version.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n\n");
}
