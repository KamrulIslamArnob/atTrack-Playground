import type { ResumeAppearance, ResumeDoc } from "@/lib/types/resume-builder";

export interface ResumeBuilderState {
  doc: ResumeDoc;
  past: ResumeDoc[];
  future: ResumeDoc[];
  dirty: boolean;
  saveStatus: "idle" | "dirty" | "saving" | "saved" | "error";
  saveMessage: string | null;
}

export type ResumeAction =
  | { type: "PATCH_DOC"; payload: Partial<ResumeDoc> }
  | { type: "PATCH_HEADER"; payload: Partial<ResumeDoc["header"]> }
  | { type: "PATCH_SECTION"; section: string; payload: Record<string, unknown> }
  | { type: "PATCH_APPEARANCE"; payload: Partial<ResumeDoc["appearance"]> }
  | { type: "REORDER_ENTRIES"; section: string; fromIndex: number; toIndex: number }
  | { type: "ADD_ENTRY"; section: string; entry: Record<string, unknown> }
  | { type: "REMOVE_ENTRY"; section: string; id: string }
  | { type: "TOGGLE_VISIBILITY"; section: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; payload: ResumeDoc }
  | { type: "MARK_SAVED" }
  | { type: "SET_SAVE_STATUS"; status: ResumeBuilderState["saveStatus"]; message?: string };

const MAX_HISTORY = 50;

export function resumeReducer(state: ResumeBuilderState, action: ResumeAction): ResumeBuilderState {
  switch (action.type) {
    case "PATCH_DOC":
      return {
        ...state,
        doc: { ...state.doc, ...action.payload },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };

    case "PATCH_HEADER":
      return {
        ...state,
        doc: { ...state.doc, header: { ...state.doc.header, ...action.payload } },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };

    case "PATCH_SECTION": {
      const sectionData = state.doc[action.section as keyof ResumeDoc] as Record<string, unknown> | undefined;
      return {
        ...state,
        doc: {
          ...state.doc,
          [action.section]: {
            ...sectionData,
            ...action.payload,
          },
        },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };
    }

    case "PATCH_APPEARANCE":
      return {
        ...state,
        doc: {
          ...state.doc,
          appearance: { ...state.doc.appearance, ...action.payload } as ResumeAppearance,
        },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };

    case "REORDER_ENTRIES": {
      const section = action.section as keyof ResumeDoc;
      const sectionData = state.doc[section] as { entries?: unknown[] } | undefined;
      const entries = [...(sectionData?.entries ?? [])];
      const [moved] = entries.splice(action.fromIndex, 1);
      entries.splice(action.toIndex, 0, moved);
      return {
        ...state,
        doc: {
          ...state.doc,
          [section]: {
            ...sectionData,
            entries,
          },
        },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };
    }

    case "ADD_ENTRY": {
      const section = action.section as keyof ResumeDoc;
      const sectionData = state.doc[section] as { entries?: unknown[] } | undefined;
      const entries = [...(sectionData?.entries ?? []), action.entry];
      return {
        ...state,
        doc: {
          ...state.doc,
          [section]: {
            ...sectionData,
            entries,
          },
        },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };
    }

    case "REMOVE_ENTRY": {
      const section = action.section as keyof ResumeDoc;
      const sectionData = state.doc[section] as { entries?: unknown[] } | undefined;
      const entries = (sectionData?.entries ?? []).filter(
        (e: unknown) => (e as { id: string }).id !== action.id
      );
      return {
        ...state,
        doc: {
          ...state.doc,
          [section]: {
            ...sectionData,
            entries,
          },
        },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };
    }

    case "TOGGLE_VISIBILITY": {
      const section = action.section as keyof ResumeDoc;
      const sectionData = state.doc[section] as { visible?: boolean } | undefined;
      const currentVisible = sectionData?.visible ?? true;
      return {
        ...state,
        doc: {
          ...state.doc,
          [section]: {
            ...sectionData,
            visible: !currentVisible,
          },
        },
        dirty: true,
        saveStatus: "dirty",
        past: [...state.past.slice(-MAX_HISTORY), state.doc],
        future: [],
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.doc],
        dirty: true,
        saveStatus: "dirty",
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc],
        future: state.future.slice(0, -1),
        dirty: true,
        saveStatus: "dirty",
      };
    }

    case "RESET":
      return {
        doc: action.payload,
        past: [],
        future: [],
        dirty: false,
        saveStatus: "idle",
        saveMessage: null,
      };

    case "MARK_SAVED":
      return { ...state, dirty: false, saveStatus: "saved", saveMessage: null };

    case "SET_SAVE_STATUS":
      return {
        ...state,
        saveStatus: action.status,
        saveMessage: action.message ?? state.saveMessage,
        dirty: action.status === "dirty" ? true : state.dirty,
      };

    default:
      return state;
  }
}

export function createInitialState(doc: ResumeDoc): ResumeBuilderState {
  return {
    doc,
    past: [],
    future: [],
    dirty: false,
    saveStatus: "idle",
    saveMessage: null,
  };
}
