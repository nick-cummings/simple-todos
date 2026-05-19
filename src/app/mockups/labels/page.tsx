import type { Metadata } from "next";
import LabelsManagerMock from "@/components/mockups/LabelsManagerMock";

export const metadata: Metadata = {
  title: "Labels mockup",
  robots: { index: false, follow: false },
};

export default function LabelsMockupPage() {
  return <LabelsManagerMock open />;
}
