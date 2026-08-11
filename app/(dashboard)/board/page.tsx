import { BoardView } from "@/components/board/board-view";
import { PageHeader } from "@/components/page-header";
import { getBoard } from "@/lib/actions/board";

export const metadata = { title: "Board" };

export default async function BoardPage() {
  const { lists, cards } = await getBoard();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Board"
        subtitle="Every job you're tracking, laid out in columns. Drag a card to move it to the next stage."
      />

      {/* Breadcrumb + toolbar + Add Job live inside BoardView, sharing one bordered
          row — not rendered standalone here, unlike every other page. */}
      <BoardView lists={lists} cards={cards} />
    </div>
  );
}
