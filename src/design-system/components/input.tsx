import { cn } from "@/design-system/cn";

export function Input({ className, ...props }: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-base text-ink",
        "placeholder:text-ink-subtle",
        "transition-[border-color] duration-150 ease-out",
        "hover:border-line-strong",
        // 16px minimum on the field itself: anything smaller makes iOS Safari
        // zoom the viewport on focus, which throws away the layout mid-typing.
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
