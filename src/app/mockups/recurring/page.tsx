import type { Metadata } from "next";

import RecurringTaskMock from "@/components/mockups/RecurringTaskMock";

export const metadata: Metadata = {
  title: "Recurring tasks mockup",
  robots: { follow: false, index: false },
};

export default function RecurringPage() {
  return <RecurringTaskMock />;
}
