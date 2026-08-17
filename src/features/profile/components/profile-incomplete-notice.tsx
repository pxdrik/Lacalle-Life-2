"use client";

import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";

import { useProfile } from "../hooks/use-profile";

/**
 * A non-blocking invitation to fill in the profile, shown only while there
 * is none.
 *
 * Hoje already works without a profile — that is a delivered requirement,
 * not a bug this notice papers over. But nothing on the screen told a
 * first-time visitor that filling one in unlocks the calorie ring and macro
 * targets, which is exactly the first-contact confusion this notice exists
 * to close. It disappears the moment a profile exists; no dismiss button,
 * because there is nothing to dismiss once the reason for it is gone.
 */
export function ProfileIncompleteNotice() {
  const { state } = useProfile();

  if (state.status !== "empty") return null;

  return (
    <Notice tone="info" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Complete seu perfil para ver metas de calorias e macros aqui.
        </p>
        <Link href="/perfil" className={buttonClasses("secondary", "sm")}>
          Completar perfil
        </Link>
      </div>
    </Notice>
  );
}
