import { test, expect, type Page } from "@playwright/test";
import { createRoom, fillRoomForm, joinRoom, paintAndWaitForSave } from "./helpers";
import { expectNoSeriousA11yViolations } from "./ui-kit/axe";
import { expectStableLayout, recordLayoutShifts, resetLayoutShifts } from "./ui-kit/layout-shift";

// The UI standard's checks on every screen (COMPANY/UI_STANDARDS.md §5): no serious accessibility violation, no
// layout shift when a message appears or changes, and no console error (a hydration mismatch is otherwise silent:
// the page still works and every other spec stays green).

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("create form: accessible, and a refused submit moves nothing and focuses the field", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await recordLayoutShifts(page);
  await fillRoomForm(page, { title: "UI check", startDate: "2027-03-10", endDate: "2027-03-01" });
  await expectNoSeriousA11yViolations(page);

  await resetLayoutShifts(page);
  await page.getByRole("button", { name: "Create room & get link" }).click();
  await expect(page.getByText("End date must be on or after the start date")).toBeVisible();
  await expect(page.getByLabel("To", { exact: true })).toBeFocused();
  await expectStableLayout(page);
  await expectNoSeriousA11yViolations(page);
  expect(errors).toEqual([]);
});

test("join form, grid, results and dialogs: accessible, and saving moves nothing", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await recordLayoutShifts(page);
  const slug = await createRoom(page, { title: "UI check", startDate: "2027-03-01", endDate: "2027-03-02" });
  await expectNoSeriousA11yViolations(page);

  await joinRoom(page, "Checker");
  await expect(page.getByText("Marking as Checker")).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await resetLayoutShifts(page);
  await paintAndWaitForSave(page, "slot-2027-03-01-9");
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText("Saved")).toBeHidden();
  await expectStableLayout(page);

  // The grid's detail opens on demand, in the top layer.
  await resetLayoutShifts(page);
  await page.getByRole("button", { name: "How to mark" }).click();
  await expect(page.getByText(/Prefer. only applies/)).toBeVisible();
  await expectStableLayout(page);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeFocused();

  await page.goto(`/r/${slug}/results`);
  await expect(page.getByRole("heading", { name: "Best times" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  expect(errors).toEqual([]);
});
