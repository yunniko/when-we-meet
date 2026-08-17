import { test, expect } from "@playwright/test";
import { createRoom, joinRoom, paintAndWaitForSave } from "./helpers";

test("create room, join, mark availability (incl. preferred), and see it in results", async ({ page }) => {
  const slug = await createRoom(page, {
    title: "E2E Trip",
    startDate: "2027-01-15",
    endDate: "2027-01-16",
  });

  await joinRoom(page, "Playwright Tester");
  await expect(page.getByText("Marking as Playwright Tester")).toBeVisible();

  // Default room is "whole day" (dayStartHour 0, dayEndHour 24) -> hour 9 exists.
  await paintAndWaitForSave(page, "slot-2027-01-15-9");

  // Switch to the Prefer brush and mark the same (now-CAN) slot preferred.
  await page.getByRole("button", { name: "Prefer" }).click();
  await paintAndWaitForSave(page, "slot-2027-01-15-9");
  await expect(page.getByTestId("slot-2027-01-15-9").getByText("★")).toBeVisible();

  // Prefer must be a no-op on a slot that was never marked CAN — no save
  // request fires at all, so just confirm no star ever appears rather than
  // waiting on a response that (by design) never comes.
  await page.getByTestId("slot-2027-01-16-9").click();
  await expect(page.getByTestId("slot-2027-01-16-9").getByText("★")).toHaveCount(0);

  await page.getByRole("link", { name: "See results →" }).click();
  await expect(page).toHaveURL(new RegExp(`/r/${slug}/results$`));

  await expect(page.getByText("1 person")).toBeVisible();
  await expect(page.getByText("Best times")).toBeVisible();
  await expect(page.getByText(/1\/1 can/)).toBeVisible();
  await expect(page.getByText(/★1 prefer/)).toBeVisible();
  // The untouched slot never shows up as a "best time".
  await expect(page.getByText("Nobody has marked")).toHaveCount(0);
});
