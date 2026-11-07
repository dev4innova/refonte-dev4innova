import { Suspense } from "react";

import { CrmNav, CrmNavView } from "@/components/crm/crm-nav";

/** CRM area of the back office (EPIC 07). */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<CrmNavView pathname={null} />}>
        <CrmNav />
      </Suspense>
      {children}
    </div>
  );
}
