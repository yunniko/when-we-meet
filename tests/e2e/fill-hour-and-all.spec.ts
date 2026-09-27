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

test("double-click the corner fills the whole grid with no prompt", async ({ page }) => {
  await createRoom(page, { title: "Fill All", startDate: "2027-03-01", endDate: "2027-03-02" });
  await joinRoom(page, "Robin");

  // Mark a few slots first so the fill has real marks to overwrite.
  await dblclickAndWaitForSave(page, "date-header-2027-03-01");

  await page.getByRole("button", { name: "Can't" }).click();
  await page.getByTestId("grid-corner").dispatchEvent("dblclick");
  await expect(page.getByText("Saved")).toBeVisible();

  await page.reload();
  for (const date of ["2027-03-01", "2027-03-02"]) {
    for (const hour of [7, 9, 21]) {
      await expect(page.getByTestId(`slot-${date}-${hour}`)).toHaveClass(/bg-rose/);
    }
  }
});
