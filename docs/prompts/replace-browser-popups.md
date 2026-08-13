# Implementation Prompt: Replace All Browser Native Pop-ups with Custom Design

## Objective

Replace all 10 browser native pop-ups (`alert()`, `confirm()`, `window.confirm()`) across 6 files with custom-designed UI using the existing Dialog component and sonner toast system.

## Files to Modify

1. `components/ui/confirm-dialog.tsx` — **CREATE NEW**
2. `components/documents-list.tsx` — lines 326, 332, 344, 358, 367
3. `components/board/board-view.tsx` — line 230
4. `app/(dashboard)/preferences/ai-prompts/page.tsx` — line 71
5. `components/interview-form.tsx` — line 76
6. `components/settings/avatar-upload.tsx` — lines 33, 37
7. `components/job-detail/tabs/deadlines-tab.tsx` — line 207

---

## Step 1: Create `components/ui/confirm-dialog.tsx`

Create a new file with this exact implementation:

```tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for promise-based confirm usage
export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    title: "",
    description: undefined,
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "default",
    resolve: null,
  });

  const confirm = React.useCallback(
    (params: {
      title: string;
      description?: string;
      confirmText?: string;
      cancelText?: string;
      variant?: "default" | "destructive";
    }): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          title: params.title,
          description: params.description,
          confirmText: params.confirmText ?? "Confirm",
          cancelText: params.cancelText ?? "Cancel",
          variant: params.variant ?? "default",
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = () => {
    state.resolve?.(true);
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  };

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
      title={state.title}
      description={state.description}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      variant={state.variant}
      onConfirm={handleConfirm}
    />
  );

  return { confirm, dialog };
}
```

---

## Step 2: Replace `alert()` with `toast.error()` / `toast.info()`

### File: `components/documents-list.tsx`

**Add import at top (after existing imports):**
```tsx
import { toast } from "sonner";
```

**Line 332 — Replace:**
```tsx
alert(e instanceof Error ? e.message : "Failed to delete");
```
**With:**
```tsx
toast.error(e instanceof Error ? e.message : "Failed to delete");
```

**Line 344 — Replace:**
```tsx
alert(e instanceof Error ? e.message : "Failed to set default");
```
**With:**
```tsx
toast.error(e instanceof Error ? e.message : "Failed to set default");
```

**Line 358 — Replace:**
```tsx
alert(e instanceof Error ? e.message : "Failed to download");
```
**With:**
```tsx
toast.error(e instanceof Error ? e.message : "Failed to download");
```

**Line 367 — Replace:**
```tsx
alert(e instanceof Error ? e.message : "Failed to open folder");
```
**With:**
```tsx
toast.error(e instanceof Error ? e.message : "Failed to open folder");
```

---

### File: `components/settings/avatar-upload.tsx`

**Add import at top:**
```tsx
import { toast } from "sonner";
```

**Line 33 — Replace:**
```tsx
alert("Please select a JPG, PNG, or GIF image.");
```
**With:**
```tsx
toast.error("Please select a JPG, PNG, or GIF image.");
```

**Line 37 — Replace:**
```tsx
alert("File size must be less than 500KB.");
```
**With:**
```tsx
toast.error("File size must be less than 500KB.");
```

---

## Step 3: Replace `confirm()`/`window.confirm()` with `useConfirm()` hook

### Pattern A: Inline handler replacement (for simple confirm-in-handler cases)

For files where `confirm()` is called inside an event handler:

**1. Add import at top:**
```tsx
import { useConfirm } from "@/components/ui/confirm-dialog";
```

**2. Inside the component function, declare the hook:**
```tsx
const { confirm, dialog } = useConfirm();
```

**3. Replace the confirm call:**
```tsx
// BEFORE:
if (!confirm("message")) return;

// AFTER:
const confirmed = await confirm({
  title: "Dialog Title",
  description: "Dialog description message",
  confirmText: "Confirm Button",
  variant: "destructive",
});
if (!confirmed) return;
```

**4. Render the dialog by placing `{dialog}` inside the component's JSX return (before the closing tag):**
```tsx
{dialog}
```

---

### File: `components/documents-list.tsx` — Delete confirm (line 326)

**Add import:**
```tsx
import { useConfirm } from "@/components/ui/confirm-dialog";
```

**Inside `DocumentsList` component, add:**
```tsx
const { confirm, dialog } = useConfirm();
```

**Replace line 326 — Change `handleDelete` from:**
```tsx
const handleDelete = async (id: string, name: string) => {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  setPendingId(id);
  try {
    await deleteDocument(id);
    router.refresh();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to delete");
  } finally {
    setPendingId(null);
  }
};
```

**To:**
```tsx
const handleDelete = async (id: string, name: string) => {
  const confirmed = await confirm({
    title: "Delete document?",
    description: `"${name}" will be permanently deleted. This cannot be undone.`,
    confirmText: "Delete",
    variant: "destructive",
  });
  if (!confirmed) return;
  setPendingId(id);
  try {
    await deleteDocument(id);
    router.refresh();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to delete");
  } finally {
    setPendingId(null);
  }
};
```

**Render dialog in JSX — Place `{dialog}` just before the closing `</div>` of the root return, inside the outer `<div className="space-y-4">` container. The safest placement is as the last child before the closing tag:**
```tsx
      {/* existing closing */}
      </div>
    </div>
  );
}
```

becomes:

```tsx
      {/* existing closing */}
      </div>
      {dialog}
    </div>
  );
}
```

**Note:** The `{dialog}` must be rendered as a sibling inside the component's return, NOT inside any conditional. It must always be in the DOM for the Dialog to work.

---

### File: `components/board/board-view.tsx` — Delete list confirm (line 230)

**Add import:**
```tsx
import { useConfirm } from "@/components/ui/confirm-dialog";
```

**Inside `BoardView` component, add:**
```tsx
const { confirm, dialog } = useConfirm();
```

**Replace line 230 — Change from:**
```tsx
if (!window.confirm(message)) return;
```

**To:**
```tsx
const confirmed = await confirm({
  title: "Delete list?",
  description: message,
  confirmText: "Delete",
  variant: "destructive",
});
if (!confirmed) return;
```

**Render dialog in JSX — Place `{dialog}` inside the fragment `<>` return, as the last child before the closing `</>`:**
```tsx
      <JobDetailSheet
        jobId={openJobId}
        lists={lists}
        onOpenChange={(open) => setOpenJobId(open ? openJobId : null)}
        onMoveTo={handleMove}
      />
      {dialog}
    </>
  );
}
```

---

### File: `app/(dashboard)/preferences/ai-prompts/page.tsx` — Reset confirm (line 71)

**Add import:**
```tsx
import { useConfirm } from "@/components/ui/confirm-dialog";
```

**Inside `AiPromptsPreferencesPage` component, add:**
```tsx
const { confirm, dialog } = useConfirm();
```

**Replace line 71 — Change from:**
```tsx
if (!confirm(`Reset prompt for "${activeTool.label}" back to default?`)) return;
```

**To:**
```tsx
const confirmed = await confirm({
  title: "Reset prompt?",
  description: `Reset the prompt for "${activeTool.label}" back to the default template. Your custom changes will be lost.`,
  confirmText: "Reset",
  variant: "default",
});
if (!confirmed) return;
```

**Render dialog in JSX — Place `{dialog}` just before the closing `</div>` of the root return:**
```tsx
      </div>
      {dialog}
    </div>
  );
}
```

---

### File: `components/interview-form.tsx` — Delete interview confirm (line 76)

**Add import:**
```tsx
import { useConfirm } from "@/components/ui/confirm-dialog";
```

**Inside `InterviewForm` component, add:**
```tsx
const { confirm, dialog } = useConfirm();
```

**Replace line 76 — Change from:**
```tsx
if (!confirm("Delete this interview?")) return;
```

**To:**
```tsx
const confirmed = await confirm({
  title: "Delete interview?",
  description: "This interview will be permanently removed. This cannot be undone.",
  confirmText: "Delete",
  variant: "destructive",
});
if (!confirmed) return;
```

**Render dialog in JSX — This component returns a `<>` fragment with the overlay div. Place `{dialog}` as the last child before the closing `</>`:**
```tsx
      </div>
      {dialog}
    </>
  );
}
```

---

### File: `components/job-detail/tabs/deadlines-tab.tsx` — Delete deadline confirm (line 207)

**Add import:**
```tsx
import { useConfirm } from "@/components/ui/confirm-dialog";
```

**Inside `DeadlinesTab` component, add:**
```tsx
const { confirm, dialog } = useConfirm();
```

**Replace line 207 — Change `handleDelete` from:**
```tsx
const handleDelete = (id: string) => {
  if (!confirm("Are you sure you want to delete this deadline milestone?")) return;
  startTransition(async () => {
    try {
      await deleteJobDeadline(id);
      toast.success("Deadline deleted");
      await loadDeadlines();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete deadline");
    }
  });
};
```

**To:**
```tsx
const handleDelete = async (id: string) => {
  const confirmed = await confirm({
    title: "Delete deadline?",
    description: "This deadline milestone will be permanently removed.",
    confirmText: "Delete",
    variant: "destructive",
  });
  if (!confirmed) return;
  startTransition(async () => {
    try {
      await deleteJobDeadline(id);
      toast.success("Deadline deleted");
      await loadDeadlines();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete deadline");
    }
  });
};
```

**Render dialog in JSX — Place `{dialog}` just before the closing `</div>` of the root return:**
```tsx
      </div>
      {dialog}
    </div>
  );
}
```

---

## Verification Checklist

After all changes, verify:

- [ ] No `alert(` calls remain in any of the 7 files
- [ ] No `confirm(` calls remain in any of the 7 files
- [ ] No `window.confirm(` calls remain in any of the 7 files
- [ ] `toast.error()` or `toast.info()` replaces all `alert()` calls
- [ ] `useConfirm()` hook replaces all `confirm()`/`window.confirm()` calls
- [ ] Each component using `useConfirm` renders `{dialog}` in its JSX
- [ ] All destructive actions use `variant: "destructive"`
- [ ] All non-destructive confirmations use `variant: "default"`
- [ ] The original message text from each alert/confirm is preserved in the dialog or toast

## Design Spec

| Property | Default Variant | Destructive Variant |
|----------|----------------|-------------------|
| Confirm button | `variant="default"` | `variant="destructive"` |
| Cancel button | `variant="outline"` | `variant="outline"` |
| Dialog width | `max-w-sm` | `max-w-sm` |
| Close button | shown | shown |

## Key Constraints

1. **Always use `await confirm(...)`** — the hook returns a Promise<boolean>
2. **Always check the return value** — `if (!confirmed) return;`
3. **Always render `{dialog}`** — without it, the dialog won't appear
4. **Preserve all message text** — move the exact string into `description` for confirm dialogs, or keep as-is for toasts
5. **Match existing patterns** — `toast.error()` for errors, `toast.success()` for successes (already used throughout codebase)
6. **Use `"use client"`** — all components using `useConfirm` are already client components

## Example Usage Pattern (for reference)

```tsx
const { confirm, dialog } = useConfirm();

const handleAction = async () => {
  const confirmed = await confirm({
    title: "Are you sure?",
    description: "This action cannot be undone.",
    confirmText: "Proceed",
    variant: "destructive",
  });
  if (!confirmed) return;
  // proceed with action
};

return (
  <>
    {/* component JSX */}
    {dialog}
  </>
);
```
