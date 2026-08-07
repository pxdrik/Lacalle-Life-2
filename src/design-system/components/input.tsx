import { cn } from "@/design-system/cn";

export function Input({ className, ...props }: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-(--control-h) w-full rounded-lg border border-line bg-surface",
        "px-(--control-px) text-ink",
        // 16px minimum on the field itself: anything smaller makes iOS Safari
        // zoom the viewport on focus, which throws away the layout mid-typing.
        // The desk has no such constraint, so it gets the denser size.
        "text-base md:text-sm",
        "placeholder:text-ink-subtle",
        "transition-[border-color] duration-150 ease-out",
        "hover:border-line-strong",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
