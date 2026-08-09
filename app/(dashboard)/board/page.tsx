import { BoardView } from "@/components/board/board-view";
import { getBoard } from "@/lib/actions/board";

export const metadata = { title: "Board" };

export default async function BoardPage() {
  const { lists, cards } = await getBoard();

  return (
    // -mt-5 pulls the title row up to match the sidebar's logo/search row (both
    // start at the same 12px offset), which also happens to land the toolbar
    // row's "Home" breadcrumb even with the sidebar's profile name row below it —
    // measured via the rendered page, not guessed from Tailwind class math.
    <div className="-mt-5 space-y-4">
      <div className="-mx-6 border-b border-border px-6 pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Board
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Every job you&apos;re tracking, laid out in columns. Drag a card to move it to the next stage.
        </p>
      </div>

      {/* Breadcrumb + toolbar + Add Job live inside BoardView, sharing one bordered
          row — not rendered standalone here, unlike every other page. */}
      <BoardView lists={lists} cards={cards} />
    </div>
  );
}
