"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_LIST_COLORS, type BoardList } from "@/lib/types/board";

interface MoveToMenuProps {
  lists: BoardList[];
  currentListId: string | null;
  onMoveTo: (listId: string) => void;
  renderTrigger: React.ReactElement;
  children: React.ReactNode;
  extraItems?: React.ReactNode;
}

export function MoveToMenu({
  lists,
  currentListId,
  onMoveTo,
  renderTrigger,
  children,
  extraItems,
}: MoveToMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={renderTrigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Move to
          </DropdownMenuLabel>
          {lists.map((list) => (
            <DropdownMenuItem
              key={list.id}
              disabled={list.id === currentListId}
              onClick={() => onMoveTo(list.id)}
              className="cursor-pointer text-xs font-medium active:scale-95 transition-colors"
            >
              <span
                className="mr-2 size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    list.color ?? DEFAULT_LIST_COLORS[list.kind] ?? "var(--primary)",
                }}
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
