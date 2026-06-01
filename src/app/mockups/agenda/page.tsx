import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import AgendaViewsMock from "@/components/mockups/AgendaViewsMock";

export const metadata: Metadata = {
  title: "Agenda views mockup",
  robots: { follow: false, index: false },
};

export default function AgendaPage() {
  if (!mockupsEnabled()) notFound();
  return <AgendaViewsMock />;
}
