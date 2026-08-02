"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { X, Check, XIcon, RotateCcw, ChevronRight } from "lucide-react";
import { generateMCQTest } from "@/lib/actions/mcq";
import type { MCQTest, MCQQuestion } from "@/lib/types/mcq";

interface MCQTestProps {
  jobId: string;
  onClose: () => void;
}

export function MCQTest({ jobId, onClose }: MCQTestProps) {
  const [test, setTest] = useState<MCQTest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateMCQTest(jobId);
      setTest(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleRetake = () => {
    setAnswers({});
    setSubmitted(false);
    setCurrentQ(0);
  };

  const getScore = () => {
    if (!test) return { correct: 0, total: 0 };
    let correct = 0;
    test.questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) correct++;
    });
    return { correct, total: test.questions.length };
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-4xl border border-border bg-card p-6 shadow-md text-center">
          <div className="mx-auto size-12 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Generating interview questions...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-4xl border border-border bg-card p-6 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">MCQ Test</h2>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-3 text-sm text-destructive">{error}</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerate}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Start screen
  if (!test) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-4xl border border-border bg-card p-6 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">MCQ Practice Test</h2>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Test your knowledge with 12 interview questions generated from the job posting.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerate}>
              Start Test
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Results screen
  if (submitted) {
    const { correct, total } = getScore();
    const percentage = Math.round((correct / total) * 100);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-4xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Results</h2>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 text-center">
            <div className="text-4xl font-bold">
              {correct}/{total}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {percentage}% correct
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {test.questions.map((q, i) => {
              const userAnswer = answers[q.id];
              const isCorrect = userAnswer === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className={`rounded-4xl border p-4 ${
                    isCorrect
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
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
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        {q.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handleRetake}>
              <RotateCcw className="mr-1 size-3" />
              Retake
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Question screen
  const question = test.questions[currentQ];
  const total = test.questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-4xl border border-border bg-card p-6 shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Question {currentQ + 1} of {total}</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((currentQ + 1) / total) * 100}%` }}
          />
        </div>

        <div className="mt-4">
          <p className="font-medium">{question.question}</p>

          <div className="mt-4 space-y-2">
            {question.options.map((option, i) => {
              const isSelected = answers[question.id] === i;

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(question.id, i)}
                  className={`flex w-full items-center gap-3 rounded-4xl border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm">{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            {test.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`size-2 rounded-full transition-colors ${
                  i === currentQ
                    ? "bg-primary"
                    : answers[test.questions[i].id] !== undefined
                      ? "bg-primary/40"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
              disabled={currentQ === 0}
            >
              Previous
            </Button>
            {currentQ < total - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentQ(currentQ + 1)}
              >
                Next
                <ChevronRight className="ml-1 size-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={answeredCount < total}
              >
                Submit ({answeredCount}/{total})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
