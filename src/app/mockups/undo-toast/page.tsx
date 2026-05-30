import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import UndoToastMock from "@/components/mockups/UndoToastMock";

export const metadata: Metadata = {
  title: "Undo toast mockup",
  robots: { follow: false, index: false },
};

export default function UndoToastPage() {
  if (!mockupsEnabled()) notFound();
  return <UndoToastMock />;
}
