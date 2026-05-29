import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import LabelPickerMock from "@/components/mockups/LabelPickerMock";

export const metadata: Metadata = {
  title: "Label picker mockup",
  robots: { index: false, follow: false },
};

export default function LabelPickerMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <LabelPickerMock />;
}
