import { getLinksAndCategories } from "@/lib/actions/links";
import { LinksView } from "@/components/links/links-view";

export const metadata = {
  title: "Social Links & Resources | Aven / AtTrack",
  description: "Organize and quick-launch professional links, career resources, and job portals.",
};

export default async function LinksPage() {
  const { categories, links, shortcuts } = await getLinksAndCategories();

  return (
    <LinksView
      initialCategories={categories}
      initialLinks={links}
      initialShortcuts={shortcuts}
    />
  );
}

