"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

interface CommandContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const CommandContext = React.createContext<CommandContextValue>({
  value: "",
  onValueChange: () => {},
});

function useCommand() {
  return React.useContext(CommandContext);
}

interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, value: controlledValue, onValueChange: controlledOnValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState("");

    const value = controlledValue ?? internalValue;
    const onValueChange = controlledOnValueChange ?? setInternalValue;

    return (
      <CommandContext.Provider value={{ value, onValueChange }}>
        <div
          ref={ref}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl shadow-black/15",
            className
          )}
          {...props}
        />
      </CommandContext.Provider>
    );
  }
);
Command.displayName = "Command";

interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  isLoading?: boolean;
}

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, onClear, isLoading, ...props }, ref) => {
    const { value, onValueChange } = useCommand();

    return (
      <div className="flex items-center border-b border-border/70 px-4 py-1">
        <Search className="mr-3 size-4.5 shrink-0 text-muted-foreground/70" />
        <input
          ref={ref}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={cn(
            "flex h-12 w-full bg-transparent py-3 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
            title="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }
);
CommandInput.displayName = "CommandInput";

type CommandListProps = React.HTMLAttributes<HTMLDivElement>;

const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("max-h-[380px] overflow-y-auto overflow-x-hidden p-1.5 scrollbar-minimal", className)}
      {...props}
    />
  )
);
CommandList.displayName = "CommandList";

type CommandEmptyProps = React.HTMLAttributes<HTMLDivElement>;

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("py-8 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
);
CommandEmpty.displayName = "CommandEmpty";

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden py-1 text-foreground",
        className
      )}
      {...props}
    >
      {heading && (
        <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {heading}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
);
CommandGroup.displayName = "CommandGroup";

interface CommandItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  value?: string;
  onItemSelect?: (value: string) => void;
  isActive?: boolean;
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, value: itemValue, onItemSelect, isActive, ...props }, ref) => {
    const { value } = useCommand();
    const isSelected = isActive || value === itemValue;

    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex cursor-pointer select-none items-center rounded-xl px-2.5 py-2 text-sm outline-none transition-all duration-150",
          isSelected
            ? "bg-muted text-foreground font-medium shadow-2xs"
            : "text-foreground hover:bg-muted/70",
          className
        )}
        onClick={() => onItemSelect?.(itemValue ?? "")}
        {...props}
      />
    );
  }
);
CommandItem.displayName = "CommandItem";

type CommandSeparatorProps = React.HTMLAttributes<HTMLDivElement>;

const CommandSeparator = React.forwardRef<HTMLDivElement, CommandSeparatorProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("my-1.5 h-px bg-border/60", className)}
      {...props}
    />
  )
);
CommandSeparator.displayName = "CommandSeparator";

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
};
