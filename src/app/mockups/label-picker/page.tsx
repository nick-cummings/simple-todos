import type { Metadata } from "next";
import LabelPickerMock from "@/components/mockups/LabelPickerMock";

export const metadata: Metadata = {
  title: "Label picker mockup",
  robots: { index: false, follow: false },
};

export default function LabelPickerMockupPage() {
  return <LabelPickerMock />;
}
