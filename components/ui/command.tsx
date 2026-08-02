"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

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
            "flex w-full flex-col overflow-hidden rounded-4xl border border-border bg-card text-card-foreground shadow-md",
            className
          )}
          {...props}
        />
      </CommandContext.Provider>
    );
  }
);
Command.displayName = "Command";

type CommandInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, ...props }, ref) => {
    const { value, onValueChange } = useCommand();

    return (
      <div className="flex items-center border-b border-border px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 size-4 shrink-0 opacity-50"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={ref}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={cn(
            "flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
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
      className={cn("max-h-[200px] overflow-y-auto overflow-x-hidden py-1", className)}
      {...props}
    />
  )
);
CommandList.displayName = "CommandList";

type CommandEmptyProps = React.HTMLAttributes<HTMLDivElement>;

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
  (props, ref) => (
    <div
      ref={ref}
      className="py-6 text-center text-sm text-muted-foreground"
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
        "overflow-hidden p-1 text-foreground",
        className
      )}
      {...props}
    >
      {heading && (
        <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
);
CommandGroup.displayName = "CommandGroup";

interface CommandItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  value?: string;
  onItemSelect?: (value: string) => void;
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, value: itemValue, onItemSelect, ...props }, ref) => {
    const { value } = useCommand();
    const isSelected = value === itemValue;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex cursor-pointer select-none items-center rounded-4xl px-3 py-2 text-sm outline-none transition-colors",
          isSelected && "bg-primary/10 text-primary",
          "hover:bg-muted hover:text-foreground",
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
      className={cn("-mx-1 h-px bg-border", className)}
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
