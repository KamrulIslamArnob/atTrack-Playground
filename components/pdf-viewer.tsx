"use client";

import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Spinner } from "@/components/ui/spinner";
import { ZoomIn, ZoomOut } from "lucide-react";

// Local worker, not a CDN — see lib/utils/pdf-extract.ts for why.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
  fileName: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [pages, setPages] = useState<number[]>([]);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        setPages(Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setLoading(false);
      }
    };

    loadPdf();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
          className="flex size-8 items-center justify-center rounded-2xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="text-sm text-muted-foreground min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(s + 0.1, 3))}
          className="flex size-8 items-center justify-center rounded-2xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>

      {/* All pages */}
      <div className="flex flex-col items-center gap-4">
        {pages.map((pageNum) => (
          <PdfPage key={pageNum} url={url} pageNum={pageNum} scale={scale} />
        ))}
      </div>
    </div>
  );
}

function PdfPage({ url, pageNum, scale }: { url: string; pageNum: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    const renderPage = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTask = page.render({
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;

        if (!cancelled) setRendered(true);
      } catch (err) {
        // pdf.js throws a RenderingCancelledException when a render is cancelled
        // mid-flight (expected when scale changes rapidly) — don't log that as a
        // real error, only log genuine failures.
        const isCancelled = err instanceof Error && err.name === "RenderingCancelledException";
        if (!isCancelled) {
          console.error(`Failed to render page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [url, pageNum, scale]);

  return (
    <div className="relative">
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <Spinner className="size-6" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="shadow-lg rounded-2xl"
      />
    </div>
  );
}
