import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom } from "./helpers";

// Ties the wait to the grid's own save-state indicator rather than sniffing
// the network — see fill-day.spec.ts for why (a generic "any POST returns
// 200" matcher can resolve on an unrelated or still-in-flight response
// under parallel-worker load and let a following check race ahead of the
// real save).
async function dblclickAndWaitForSave(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).dispatchEvent("dblclick");
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText("Saved")).toBeHidden();
}

test("double-click an hour label fills that hour across every day", async ({ page }) => {
  await createRoom(page, { title: "Fill Hour", startDate: "2027-03-01", endDate: "2027-03-03" });
  await joinRoom(page, "Robin");

  await dblclickAndWaitForSave(page, "hour-header-9");
  for (const date of ["2027-03-01", "2027-03-02", "2027-03-03"]) {
    await expect(page.getByTestId(`slot-${date}-9`)).toHaveClass(/bg-emerald/);
  }
  // A different hour is untouched.
  await expect(page.getByTestId("slot-2027-03-01-10")).not.toHaveClass(/bg-emerald/);

  await page.reload();
  for (const date of ["2027-03-01", "2027-03-02", "2027-03-03"]) {
    await expect(page.getByTestId(`slot-${date}-9`)).toHaveClass(/bg-emerald/);
  }
});

test("double-click the corner fills the whole grid directly when few slots are marked", async ({
  page,
}) => {
  await createRoom(page, { title: "Fill All Small", startDate: "2027-03-01", endDate: "2027-03-01" });
  await joinRoom(page, "Robin");

  // Whole day is 07:00-22:00; a single-day room, so filling one hour marks
  // exactly 1 slot — comfortably under the >3 confirmation threshold.
  await dblclickAndWaitForSave(page, "hour-header-7");
  await expect(page.getByTestId("slot-2027-03-01-7")).toHaveClass(/bg-emerald/);

  await page.getByTestId("grid-corner").dispatchEvent("dblclick");
  await expect(page.getByTestId("fill-all-confirm")).toHaveCount(0);
  await expect(page.getByText("Saved")).toBeVisible();
  for (const hour of [7, 9, 15, 21]) {
    await expect(page.getByTestId(`slot-2027-03-01-${hour}`)).toHaveClass(/bg-emerald/);
  }
});

test("double-click the corner asks for confirmation once more than 3 slots are already marked", async ({
  page,
}) => {
  await createRoom(page, { title: "Fill All Confirm", startDate: "2027-03-01", endDate: "2027-03-02" });
  await joinRoom(page, "Robin");

  // Fill one whole day (more than 3 slots) with CAN first.
  await dblclickAndWaitForSave(page, "date-header-2027-03-01");

  // Switch brush so the corner fill would actually change things, then
  // double-click the corner: over the threshold, so it must ask first
  // rather than silently overwriting everything.
  const cannotButton = page.getByRole("button", { name: "Can't" });
  await cannotButton.click();
  await expect(cannotButton).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("grid-corner").dispatchEvent("dblclick");
  const confirm = page.getByTestId("fill-all-confirm");
  await expect(confirm).toBeVisible();
  // Nothing has changed yet — still CAN, not CANNOT.
  await expect(page.getByTestId("slot-2027-03-01-9")).toHaveClass(/bg-emerald/);

  await page.getByTestId("fill-all-confirm-button").click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("slot-2027-03-01-9")).toHaveClass(/bg-rose/);
  await expect(page.getByTestId("slot-2027-03-02-9")).toHaveClass(/bg-rose/);
});

test("canceling the corner confirmation leaves everything untouched", async ({ page }) => {
  await createRoom(page, { title: "Fill All Cancel", startDate: "2027-03-01", endDate: "2027-03-02" });
  await joinRoom(page, "Robin");

  await dblclickAndWaitForSave(page, "date-header-2027-03-01");

  await page.getByRole("button", { name: "Can't" }).click();
  await page.getByTestId("grid-corner").dispatchEvent("dblclick");
  const confirm = page.getByTestId("fill-all-confirm");
  await expect(confirm).toBeVisible();

  await page.getByText("Cancel", { exact: true }).click();
  await expect(confirm).toHaveCount(0);
  // Still the original CAN marks — nothing was applied.
  await expect(page.getByTestId("slot-2027-03-01-9")).toHaveClass(/bg-emerald/);
  await expect(page.getByTestId("slot-2027-03-02-9")).not.toHaveClass(/bg-rose|bg-emerald/);
});
