import type { LucideIcon } from "lucide-react";

import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { cn } from "@/design-system/cn";

interface Action {
  readonly label: string;
  readonly onClick: () => void;
  readonly icon?: LucideIcon | undefined;
}

interface Props {
  /** Contained, never decorative — the one visual the empty state gets. */
  readonly icon: LucideIcon;
  /** The required sentence. Everything else is optional. */
  readonly title: string;
  /** What to do next, when the title alone isn't enough. */
  readonly caption?: string | undefined;
  /** The way out, when there's one obvious action. */
  readonly action?: Action | undefined;
  readonly className?: string | undefined;
}

/**
 * Icon, sentence, way out — the shape every empty state in the app uses.
 *
 * Promoted from `body-screen.tsx` (brandbook, seção 43: "gramática de
 * componentes"), where it was the one private implementation that already
 * had the full anatomy — icon, required phrase, optional caption, optional
 * action — instead of the shorter version other screens wrote by hand.
 *
 * Caption and action are both optional, and deliberately so: an empty state
 * with nothing useful to add past the title should say only the title. Never
 * invent a caption or an action just to fill the card.
 */
export function EmptyState({ icon: Icon, title, caption, action, className }: Props) {
  const ActionIcon = action?.icon;

  return (
    <Card tone="quiet" className={cn("text-center", className)}>
      <Icon aria-hidden className="mx-auto size-8 text-ink-subtle" />
      <p className="mt-3 text-ink">{title}</p>
      {caption !== undefined && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-subtle">
          {caption}
        </p>
      )}
      {action !== undefined && (
        <Button className="mt-5" onClick={action.onClick}>
          {ActionIcon !== undefined && (
            <ActionIcon aria-hidden className="size-4" />
          )}
          {action.label}
        </Button>
      )}
    </Card>
  );
}
