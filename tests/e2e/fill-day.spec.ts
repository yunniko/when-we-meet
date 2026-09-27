import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom } from "./helpers";

// Double-clicking (or double-tapping — the browser synthesizes the same
// dblclick event from two quick taps once double-tap-to-zoom is disabled,
// which the grid already does via touch-action: manipulation; confirmed
// separately with raw CDP touch events on a Pixel 5 emulation) a day's
// header fills every hour of that day with the current brush in one save.
//
// Fires the dblclick as a real DOM event rather than via locator.dblclick(),
// which drives actual OS-timed mouse clicks: under parallel-worker load the
// two synthetic clicks can land further apart than the browser's own
// double-click window and never coalesce into a dblclick, which is a
// Playwright/OS timing artifact, not something this test is meant to cover.
// Waits for the save the fill triggers to round-trip, not just for the
// (immediate, optimistic) local class change — otherwise a following
// `page.reload()` can race the in-flight save and see stale server data.
// Ties the wait to the grid's own save-state indicator (driven by that
// specific saveAvailability() call's own promise) rather than sniffing
// for "any POST that returns 200": under parallel-worker load, a generic
// network matcher can resolve early on an unrelated or still-in-flight
// response from an earlier action, letting the reload race ahead of the
// real save. Also waits for the indicator to clear afterward so a
// following call can't mistake this save's lingering "Saved" text for its
// own.
async function fillDayAndWaitForSave(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).dispatchEvent("dblclick");
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText("Saved")).toBeHidden();
}

test("double-click a date header fills the whole day with the current brush", async ({ page }) => {
  // Three days: the first is filled CAN and left alone, the second is
  // filled CANNOT, the third is never touched — so a single reload at the
  // end can prove all three persisted correctly, without any intermediate
  // reload (which would reset the in-page brush selection back to its
  // default and invalidate the next action).
  await createRoom(page, { title: "Fill Day", startDate: "2027-02-01", endDate: "2027-02-03" });
  await joinRoom(page, "Dana");

  // Default brush is CAN.
  await fillDayAndWaitForSave(page, "date-header-2027-02-01");
  for (const hour of [7, 9, 15, 21]) {
    await expect(page.getByTestId(`slot-2027-02-01-${hour}`)).toHaveClass(/bg-emerald/);
  }

  // Switch brush and fill a different day: every cell in that column changes.
  const cannotButton = page.getByRole("button", { name: "Can't" });
  await cannotButton.click();
  await expect(cannotButton).toHaveAttribute("aria-pressed", "true");
  await fillDayAndWaitForSave(page, "date-header-2027-02-02");
  for (const hour of [7, 9, 15, 21]) {
    await expect(page.getByTestId(`slot-2027-02-02-${hour}`)).toHaveClass(/bg-rose/);
  }
  // The third day is untouched.
  await expect(page.getByTestId("slot-2027-02-03-9")).not.toHaveClass(/bg-rose|bg-emerald/);

  // Reloading and re-reading from the server-rendered grid confirms both
  // saves actually persisted, not just that the optimistic local class
  // changed.
  await page.reload();
  await expect(page.getByTestId("slot-2027-02-01-9")).toHaveClass(/bg-emerald/);
  await expect(page.getByTestId("slot-2027-02-01-21")).toHaveClass(/bg-emerald/);
  await expect(page.getByTestId("slot-2027-02-02-9")).toHaveClass(/bg-rose/);
  await expect(page.getByTestId("slot-2027-02-02-21")).toHaveClass(/bg-rose/);
  await expect(page.getByTestId("slot-2027-02-03-9")).not.toHaveClass(/bg-rose|bg-emerald/);
});
