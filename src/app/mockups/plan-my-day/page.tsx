import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import PlanMyDayMock from "@/components/mockups/PlanMyDayMock";

export const metadata: Metadata = {
  title: "Plan my day mockup",
  robots: { follow: false, index: false },
};

export default function PlanMyDayPage() {
  if (!mockupsEnabled()) notFound();
  return <PlanMyDayMock />;
}
