import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import VoiceCaptureMock from "@/components/mockups/VoiceCaptureMock";

export const metadata: Metadata = {
  title: "Voice capture mockup",
  robots: { index: false, follow: false },
};

export default function VoiceMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <VoiceCaptureMock />;
}
