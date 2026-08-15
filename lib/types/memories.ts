export interface AiMemory {
  id: string;
  user_id: string;
  title: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryInput {
  title?: string | null;
  description: string;
}

export interface UpdateMemoryInput {
  title?: string | null;
  description: string;
}
