import { test, expect } from "@playwright/test";
import { createRoom, joinRoom, paintAndWaitForSave } from "./helpers";

test("leaving the room deletes the participant's data and requires confirmation first", async ({ page }) => {
  await createRoom(page, {
    title: "Leave Flow",
    startDate: "2027-07-10",
    endDate: "2027-07-10",
  });

  await joinRoom(page, "Departing");
  await paintAndWaitForSave(page, "slot-2027-07-10-9");

  // The button alone doesn't delete anything -- it opens a confirmation.
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByText("This deletes your name and all your marks")).toBeVisible();
  await expect(page.getByTestId("slot-2027-07-10-9")).toBeVisible(); // still on the grid, nothing lost yet

  // Cancel backs out without deleting anything.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Marking as Departing")).toBeVisible();

  // Confirm deletes the participant and redirects to the join form.
  await page.getByRole("button", { name: "Leave the room" }).click();
  await page.getByRole("button", { name: "Yes, delete my data" }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();

  // Rejoining under the exact same name lands straight back on the grid,
  // with no "is this you?" collision prompt in between -- proof the old
  // participant (and its marks) were actually deleted, not just that the
  // cookie was cleared. If the row still existed, joinRoom would have
  // returned the collision state instead.
  await joinRoom(page, "Departing");
  await expect(page.getByText("Marking as Departing")).toBeVisible();
  await expect(page.getByText("Is this you?")).toHaveCount(0);
});
