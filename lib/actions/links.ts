"use server";

import { revalidatePath } from "next/cache";
import { from } from "@/lib/db/query";
import { getOrCreateLocalUser } from "@/lib/db/local-user";
import {
  LinkCategory,
  SocialLink,
  CreateLinkInput,
  UpdateLinkInput,
  CreateCategoryInput,
  DEFAULT_LINK_CATEGORIES,
  QuickShortcut,
  CreateQuickShortcutInput,
  UpdateQuickShortcutInput,
  DEFAULT_QUICK_SHORTCUTS,
} from "@/lib/types/links";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.links");

export async function getLinksAndCategories(): Promise<{
  categories: LinkCategory[];
  links: SocialLink[];
  shortcuts: QuickShortcut[];
}> {
  const userId = getOrCreateLocalUser().id;

  // Fetch categories sorted by sort_order
  const { data: rawCategories, error: catError } = await from("link_categories")
    .select()
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (catError) {
    log.error({ err: catError }, "Error fetching link_categories:");
  }

  let categories = (rawCategories as unknown as LinkCategory[]) ?? [];

  // Seed default categories on first launch
  if (categories.length === 0) {
    const defaultInserts = DEFAULT_LINK_CATEGORIES.map((name, index) => ({
      user_id: userId,
      name,
      sort_order: index,
      is_default: 1,
    }));

    for (const cat of defaultInserts) {
      await from("link_categories").insert(cat);
    }

    const { data: seededCategories } = await from("link_categories")
      .select()
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    categories = (seededCategories as unknown as LinkCategory[]) ?? [];
  }

  // Fetch links
  const { data: rawLinks, error: linksError } = await from("links")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (linksError) {
    log.error({ err: linksError }, "Error fetching links:");
  }

  const links = (rawLinks as unknown as SocialLink[]) ?? [];

  // Fetch quick shortcuts
  const shortcuts = await getQuickShortcuts();

  return { categories, links, shortcuts };
}


export async function createLink(input: CreateLinkInput): Promise<{ success: boolean; data?: SocialLink; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  if (!input.title || !input.title.trim()) {
    return { success: false, error: "Title is required." };
  }
  if (!input.url || !input.url.trim()) {
    return { success: false, error: "URL is required." };
  }
  if (!input.category_id) {
    return { success: false, error: "Category is required." };
  }

  let formattedUrl = input.url.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const payload = {
    user_id: userId,
    category_id: input.category_id,
    title: input.title.trim(),
    url: formattedUrl,
    notes: input.notes?.trim() || null,
    tags: input.tags ?? [],
  };

  const { data, error } = await from("links").insert(payload).select().single();

  if (error) {
    log.error({ err: error }, "Error creating link:");
    return { success: false, error: "Failed to create link." };
  }

  revalidatePath("/links");
  return { success: true, data: data as unknown as SocialLink };
}

export async function updateLink(id: string, input: UpdateLinkInput): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.url !== undefined) {
    let formattedUrl = input.url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    updates.url = formattedUrl;
  }
  if (input.category_id !== undefined) updates.category_id = input.category_id;
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
  if (input.tags !== undefined) updates.tags = input.tags ?? [];

  const { error } = await from("links").update(updates).eq("id", id).eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error updating link:");
    return { success: false, error: "Failed to update link." };
  }

  revalidatePath("/links");
  return { success: true };
}

export async function deleteLink(id: string): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  const { error } = await from("links").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error deleting link:");
    return { success: false, error: "Failed to delete link." };
  }

  revalidatePath("/links");
  return { success: true };
}

export async function moveLinkCategory(linkId: string, newCategoryId: string): Promise<{ success: boolean; error?: string }> {
  return updateLink(linkId, { category_id: newCategoryId });
}

export async function createCategory(input: CreateCategoryInput): Promise<{ success: boolean; data?: LinkCategory; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  if (!input.name || !input.name.trim()) {
    return { success: false, error: "Category name is required." };
  }

  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const { data: maxCat } = await from("link_categories")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    sortOrder = ((maxCat as { sort_order?: number } | null)?.sort_order ?? 0) + 1;
  }

  const payload = {
    user_id: userId,
    name: input.name.trim(),
    sort_order: sortOrder,
    is_default: 0,
  };

  const { data, error } = await from("link_categories").insert(payload).select().single();

  if (error) {
    log.error({ err: error }, "Error creating category:");
    return { success: false, error: "Failed to create category." };
  }

  revalidatePath("/links");
  return { success: true, data: data as unknown as LinkCategory };
}

export async function updateCategory(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  if (!name || !name.trim()) {
    return { success: false, error: "Category name cannot be empty." };
  }

  const { error } = await from("link_categories")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error updating category:");
    return { success: false, error: "Failed to update category." };
  }

  revalidatePath("/links");
  return { success: true };
}

export async function deleteCategory(
  id: string,
  targetCategoryIdForReassignment?: string
): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  // Check if active links exist in this category
  const { data: categoryLinks } = await from("links")
    .select("id")
    .eq("user_id", userId)
    .eq("category_id", id);

  const linkCount = (categoryLinks as unknown as Array<{ id: string }>)?.length ?? 0;

  if (linkCount > 0) {
    if (targetCategoryIdForReassignment) {
      // Reassign links to target category
      await from("links")
        .update({ category_id: targetCategoryIdForReassignment })
        .eq("user_id", userId)
        .eq("category_id", id);
    } else {
      // Delete links in this category
      await from("links").delete().eq("user_id", userId).eq("category_id", id);
    }
  }

  const { error } = await from("link_categories").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error deleting category:");
    return { success: false, error: "Failed to delete category." };
  }

  revalidatePath("/links");
  return { success: true };
}

export async function reorderCategories(orderedIds: string[]): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  for (let i = 0; i < orderedIds.length; i++) {
    await from("link_categories")
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i])
      .eq("user_id", userId);
  }

  revalidatePath("/links");
  return { success: true };
}

// =============================================
// Quick Shortcuts Server Actions
// =============================================

export async function getQuickShortcuts(): Promise<QuickShortcut[]> {
  const userId = getOrCreateLocalUser().id;

  const { data: rawShortcuts, error } = await from("quick_shortcuts")
    .select()
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) {
    log.error({ err: error }, "Error fetching quick_shortcuts:");
  }

  let shortcuts = (rawShortcuts as unknown as QuickShortcut[]) ?? [];

  // Seed default shortcuts if none exist
  if (shortcuts.length === 0) {
    const defaultInserts = DEFAULT_QUICK_SHORTCUTS.map((item, index) => ({
      user_id: userId,
      title: item.title,
      icon: item.icon,
      value: item.value,
      sort_order: index,
    }));

    for (const sc of defaultInserts) {
      await from("quick_shortcuts").insert(sc);
    }

    const { data: seededShortcuts } = await from("quick_shortcuts")
      .select()
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    shortcuts = (seededShortcuts as unknown as QuickShortcut[]) ?? [];
  }

  return shortcuts;
}

export async function createQuickShortcut(
  input: CreateQuickShortcutInput
): Promise<{ success: boolean; data?: QuickShortcut; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  if (!input.title || !input.title.trim()) {
    return { success: false, error: "Title is required." };
  }

  const { data: maxSc } = await from("quick_shortcuts")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    input.sort_order ?? (((maxSc as { sort_order?: number } | null)?.sort_order ?? 0) + 1);

  const payload = {
    user_id: userId,
    title: input.title.trim(),
    value: input.value?.trim() || "",
    icon: input.icon?.trim() || "link",
    sort_order: sortOrder,
  };

  const { data, error } = await from("quick_shortcuts").insert(payload).select().single();

  if (error) {
    log.error({ err: error }, "Error creating quick shortcut:");
    return { success: false, error: "Failed to create quick shortcut." };
  }

  revalidatePath("/links");
  return { success: true, data: data as unknown as QuickShortcut };
}

export async function updateQuickShortcut(
  id: string,
  input: UpdateQuickShortcutInput
): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.value !== undefined) updates.value = input.value.trim();
  if (input.icon !== undefined) updates.icon = input.icon.trim();
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;

  const { error } = await from("quick_shortcuts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error updating quick shortcut:");
    return { success: false, error: "Failed to update quick shortcut." };
  }

  revalidatePath("/links");
  return { success: true };
}

export async function deleteQuickShortcut(id: string): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;

  const { error } = await from("quick_shortcuts").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error deleting quick shortcut:");
    return { success: false, error: "Failed to delete quick shortcut." };
  }

  revalidatePath("/links");
  return { success: true };
}

export async function renameTag(
  oldTag: string,
  newTag: string
): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;
  const cleanOld = oldTag.trim().replace(/^#/, "");
  const cleanNew = newTag.trim().replace(/^#/, "");

  if (!cleanOld || !cleanNew) {
    return { success: false, error: "Tag name cannot be empty." };
  }

  if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
    return { success: true };
  }

  const { data: rawLinks, error: fetchError } = await from("links")
    .select("id, tags")
    .eq("user_id", userId);

  if (fetchError) {
    log.error({ err: fetchError }, "Error fetching links for tag rename:");
    return { success: false, error: "Failed to rename tag." };
  }

  const links = (rawLinks as unknown as Array<{ id: string; tags?: string[] | null }>) ?? [];

  for (const link of links) {
    const currentTags = link.tags ?? [];
    if (currentTags.some((t) => t.toLowerCase() === cleanOld.toLowerCase())) {
      const updatedTags = Array.from(
        new Set(
          currentTags.map((t) =>
            t.toLowerCase() === cleanOld.toLowerCase() ? cleanNew : t
          )
        )
      );
      await from("links")
        .update({ tags: updatedTags, updated_at: new Date().toISOString() })
        .eq("id", link.id)
        .eq("user_id", userId);
    }
  }

  revalidatePath("/links");
  return { success: true };
}

export async function deleteTag(
  tag: string
): Promise<{ success: boolean; error?: string }> {
  const userId = getOrCreateLocalUser().id;
  const cleanTag = tag.trim().replace(/^#/, "");

  if (!cleanTag) {
    return { success: false, error: "Tag name cannot be empty." };
  }

  const { data: rawLinks, error: fetchError } = await from("links")
    .select("id, tags")
    .eq("user_id", userId);

  if (fetchError) {
    log.error({ err: fetchError }, "Error fetching links for tag deletion:");
    return { success: false, error: "Failed to delete tag." };
  }

  const links = (rawLinks as unknown as Array<{ id: string; tags?: string[] | null }>) ?? [];

  for (const link of links) {
    const currentTags = link.tags ?? [];
    if (currentTags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
      const updatedTags = currentTags.filter(
        (t) => t.toLowerCase() !== cleanTag.toLowerCase()
      );
      await from("links")
        .update({ tags: updatedTags, updated_at: new Date().toISOString() })
        .eq("id", link.id)
        .eq("user_id", userId);
    }
  }

  revalidatePath("/links");
  return { success: true };
}

