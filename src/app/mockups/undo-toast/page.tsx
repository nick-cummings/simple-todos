import type { Metadata } from "next";

import UndoToastMock from "@/components/mockups/UndoToastMock";

export const metadata: Metadata = {
  title: "Undo toast mockup",
  robots: { follow: false, index: false },
};

export default function UndoToastPage() {
  return <UndoToastMock />;
}
