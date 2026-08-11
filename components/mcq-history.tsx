"use client";

import { useState, useEffect } from "react";
import { getMCQResults, type MCQResult } from "@/lib/actions/mcq";
import { Badge } from "@/components/ui/badge";
import { Check, XIcon, Clock } from "lucide-react";

interface MCQHistoryProps {
  jobId: string;
}

export function MCQHistory({ jobId }: MCQHistoryProps) {
  const [results, setResults] = useState<MCQResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getMCQResults(jobId).then((data) => {
      setResults(data);
      setLoading(false);
    });
  }, [jobId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">Practice Tests</h2>
        <div className="mt-4 flex justify-center py-4">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold">Practice Tests</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your past MCQ test results for this job.
      </p>

      <div className="mt-4 space-y-3">
        {results.map((result) => {
          const percentage = Math.round((result.score / result.total) * 100);
          const isExpanded = expandedId === result.id;

          return (
            <div key={result.id} className="rounded-2xl border border-border">
              <button
                onClick={() => setExpandedId(isExpanded ? null : result.id)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                      percentage >= 70
                        ? "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400"
                        : percentage >= 50
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    <span className="text-sm font-bold">{percentage}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {result.score}/{result.total} correct
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(result.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    percentage >= 70
                      ? "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400"
                      : percentage >= 50
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }
                >
                  {percentage >= 70 ? "Pass" : percentage >= 50 ? "Close" : "Needs Work"}
                </Badge>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-4">
                  <div className="space-y-2">
                    {result.questions.map((q, i) => {
                      const userAnswer = result.answers[q.id];
                      const isCorrect = userAnswer === q.correctIndex;

                      return (
                        <div
                          key={q.id}
                          className={`rounded-2xl border p-3 ${
                            isCorrect
                              ? "border-lime-300 bg-lime-50 dark:border-lime-800 dark:bg-lime-950/30"
                              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {isCorrect ? (
                              <Check className="mt-0.5 size-4 shrink-0 text-lime-600 dark:text-lime-400" />
                            ) : (
                              <XIcon className="mt-0.5 size-4 shrink-0 text-red-600" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                Q{i + 1}. {q.question}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Your answer: {q.options[userAnswer] ?? "No answer"} · Correct:{" "}
                                {q.options[q.correctIndex]}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
