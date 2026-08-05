"use client";

import { cn } from "@/design-system/cn";

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly label: string;
  readonly className?: string;
}

/**
 * Text that edits where it sits.
 *
 * The brief's rule is one click instead of three, and a name that needs an
 * "edit" button, a field and a "save" button costs three. This is an input
 * styled to read as text until it is focused — so editing is clicking on the
 * thing you want to change.
 *
 * It stays a real `<input>` rather than a `contentEditable` div, so it is
 * labelled, focusable and announced without any of it being reconstructed.
 */
export function InlineText({
  value,
  onChange,
  placeholder,
  label,
  className,
}: Props) {
  return (
    <input
      type="text"
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={cn(
        "-mx-1.5 rounded-md border border-transparent bg-transparent px-1.5 py-0.5",
        "placeholder:text-ink-subtle",
        "transition-colors duration-150 ease-out",
        "hover:border-line focus:border-line-strong focus:bg-surface",
        className,
      )}
    />
  );
}
