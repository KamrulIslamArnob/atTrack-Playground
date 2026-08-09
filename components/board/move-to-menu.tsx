"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardList } from "@/lib/types/board";

interface MoveToMenuProps {
  lists: BoardList[];
  currentListId: string | null;
  onMoveTo: (listId: string) => void;
  /** base-ui render prop: the actual trigger element (button/Button), styled by the caller. */
  renderTrigger: React.ReactElement;
  /** Trigger content — merged into renderTrigger's children. */
  children: React.ReactNode;
  /** Extra items rendered below the list of columns (e.g. "Open job details"). */
  extraItems?: React.ReactNode;
}

/**
 * Shared "Move to" dropdown — used by both the board card and the
 * job-detail-sheet header so a card's move behavior is one implementation.
 */
export function MoveToMenu({ lists, currentListId, onMoveTo, renderTrigger, children, extraItems }: MoveToMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={renderTrigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* base-ui (not Radix): a GroupLabel throws unless it is inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {lists.map((list) => (
            <DropdownMenuItem key={list.id} disabled={list.id === currentListId} onClick={() => onMoveTo(list.id)}>
              <span
                className="mr-2 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: list.color ?? "#94A3B8" }}
              />
              {list.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {extraItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
