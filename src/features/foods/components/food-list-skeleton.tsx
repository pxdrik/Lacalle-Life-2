import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";

/**
 * Placeholder rows at the real row height, so the list does not jump when the
 * data lands. Widths vary because a stack of identical bars reads as a broken
 * loader rather than as text arriving.
 */
const WIDTHS = ["w-40", "w-56", "w-32", "w-48", "w-36", "w-52", "w-44", "w-28"];

export function FoodListSkeleton() {
  return (
    <Card aria-hidden padded={false} className="overflow-hidden">
      <ul className="divide-y divide-line">
        {WIDTHS.map((width, index) => (
          <li key={index} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className={`h-3.5 ${width}`} />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <div className="flex shrink-0 gap-3 sm:gap-4">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
