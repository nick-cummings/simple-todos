import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The gate seam: each /mockups/* page asks `mockupsEnabled()` and, when
// it's false, halts rendering via `notFound()`. Unit tests cover the
// helper's logic; this asserts the pages are actually wired to it (the
// ADR 0008 wiring-seam convention). Both collaborators are mocked, and
// the heavy mock components are stubbed so we test wiring, not their UI.
const { mockupsEnabled, notFound } = vi.hoisted(() => ({
  mockupsEnabled: vi.fn(),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/mockupsEnabled", () => ({ mockupsEnabled }));
vi.mock("next/navigation", () => ({ notFound }));

vi.mock("@/components/mockups/LabelsManagerMock", () => ({
  default: () => <div data-testid="mock-component" />,
}));
vi.mock("@/components/mockups/LabelPickerMock", () => ({
  default: () => <div data-testid="mock-component" />,
}));
vi.mock("@/components/mockups/RemindersMock", () => ({
  default: () => <div data-testid="mock-component" />,
}));
vi.mock("@/components/mockups/RecurringTaskMock", () => ({
  default: () => <div data-testid="mock-component" />,
}));
vi.mock("@/components/mockups/UndoToastMock", () => ({
  default: () => <div data-testid="mock-component" />,
}));
vi.mock("@/components/mockups/MultiReminderEditorMock", () => ({
  default: () => <div data-testid="mock-component" />,
}));

import LabelsMockupPage from "./labels/page";
import LabelPickerMockupPage from "./label-picker/page";
import RemindersPage from "./reminders/page";
import RecurringPage from "./recurring/page";
import UndoToastPage from "./undo-toast/page";
import MultiRemindersPage from "./multi-reminders/page";

const pages = [
  ["labels", LabelsMockupPage],
  ["label-picker", LabelPickerMockupPage],
  ["reminders", RemindersPage],
  ["recurring", RecurringPage],
  ["undo-toast", UndoToastPage],
  ["multi-reminders", MultiRemindersPage],
] as const;

beforeEach(() => {
  mockupsEnabled.mockReset();
  notFound.mockClear();
});

describe.each(pages)("/mockups/%s page gate", (_name, Page) => {
  it("renders the mockup when mockups are enabled", () => {
    mockupsEnabled.mockReturnValue(true);
    render(<Page />);
    expect(screen.getByTestId("mock-component")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound() and renders nothing when mockups are disabled", () => {
    mockupsEnabled.mockReturnValue(false);
    expect(() => render(<Page />)).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(screen.queryByTestId("mock-component")).toBeNull();
  });
});
