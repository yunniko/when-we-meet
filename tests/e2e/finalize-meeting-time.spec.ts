import { test, expect } from "@playwright/test";
import { createRoom, joinRoom, paintAndWaitForSave } from "./helpers";

test("creator can pick, lock, and clear the final meeting time", async ({ browser, page }) => {
  const slug = await createRoom(page, {
    title: "Finalize Flow",
    startDate: "2027-04-10",
    endDate: "2027-04-11",
  });

  // The room's creator is whichever participant this (ownerToken-holding)
  // browser joins as first.
  await joinRoom(page, "Creator");
  await expect(page.getByText("Marking as Creator")).toBeVisible();
  await paintAndWaitForSave(page, "slot-2027-04-10-9");

  // A second, unrelated participant joins from a fresh browser context and
  // marks the same slot, so it's a real overlap worth picking.
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(`/r/${slug}`);
  await joinRoom(page2, "Guest");
  await paintAndWaitForSave(page2, "slot-2027-04-10-9");

  // Only the creator sees pick controls on the results page.
  await page.getByRole("link", { name: "See results →" }).click();
  await expect(page.getByText("Click a slot to set it as the meeting time")).toBeVisible();

  await page2.getByRole("link", { name: "See results →" }).click();
  await expect(page2.getByText("Click a slot to set it as the meeting time")).toHaveCount(0);

  // Creator picks the overlapping slot.
  await page.getByTestId("result-slot-2027-04-10-9").click();
  // The day label's exact word order is locale-dependent (e.g. "Sat 10 Apr"
  // vs "Sat, Apr 10") — match on the locale-independent time range instead
  // of hardcoding one order.
  await expect(page.getByText(/Meeting time set:.*09:00–10:00/)).toBeVisible();

  // The guest sees the same banner (no clear button) once they reload, and
  // marking is locked on the room page for everyone.
  await page2.goto(`/r/${slug}`);
  await expect(page2.getByText(/Meeting time set:.*09:00–10:00/)).toBeVisible();
  await expect(page2.getByRole("button", { name: "Clear selection" })).toHaveCount(0);
  await expect(page2.getByText("availability marking is closed")).toBeVisible();
  await expect(page2.getByTestId("slot-2027-04-10-10")).toHaveCount(0);

  // Creator clears it, restoring normal marking for everyone.
  await page.goto(`/r/${slug}`);
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByText("Meeting time set")).toHaveCount(0);
  await expect(page.getByTestId("slot-2027-04-10-9")).toBeVisible();

  await context2.close();
});
