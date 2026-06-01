import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import SubtasksMock from "@/components/mockups/SubtasksMock";

export const metadata: Metadata = {
  title: "Subtasks mockup",
  robots: { follow: false, index: false },
};

export default function SubtasksPage() {
  if (!mockupsEnabled()) notFound();
  return <SubtasksMock />;
}
