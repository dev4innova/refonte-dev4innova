import { Suspense } from "react";

import { AiNav, AiNavView } from "@/components/ai/ai-nav";

/** AI Gateway area of the back office (EPIC 08), for staff admins. */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<AiNavView pathname={null} />}>
        <AiNav />
      </Suspense>
      {children}
    </div>
  );
}
