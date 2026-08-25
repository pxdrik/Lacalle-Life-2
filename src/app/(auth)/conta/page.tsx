import type { Metadata } from "next";
import { CircleUserRound } from "lucide-react";

import { PageHeader } from "@/design-system/components/page-header";
import { AccountStatus } from "@/features/auth/components/account-status";

export const metadata: Metadata = {
  title: "Conta · LaCalle Life",
};

export default function AccountPage() {
  return (
    <>
      <PageHeader icon={CircleUserRound} title="Conta" />
      <div className="mt-8">
        <AccountStatus />
      </div>
    </>
  );
}
