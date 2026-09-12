import { test, expect } from "@playwright/test";
import { createRoom, joinRoom, paintAndWaitForSave } from "./helpers";

// A grid tab whose participant no longer matches the cookie (G-003 M1):
// the save is refused with a distinguishable result and the tab re-renders
// from the server instead of silently writing as nobody or as someone else.

test("a grid left open after the participant is deleted reloads to the join form on its next save", async ({
  page,
  context,
}) => {
  await createRoom(page, { title: "Stale", startDate: "2027-08-10", endDate: "2027-08-10" });
  await joinRoom(page, "Ghost");
  await paintAndWaitForSave(page, "slot-2027-08-10-9");

  // Second tab, same cookie: shows Ghost's grid.
  const stale = await context.newPage();
  await stale.goto(page.url());
  await expect(stale.getByText("Marking as Ghost")).toBeVisible();

  // First tab deletes the participant (same effect as an owner removal).
  await page.getByRole("button", { name: "Leave the room" }).click();
  await page.getByRole("button", { name: "Yes, delete my data" }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();

  // The stale tab still shows the grid; its next save is refused and the
  // tab lands on the join form rather than pretending the mark was saved.
  await expect(stale.getByTestId("slot-2027-08-10-10")).toBeVisible();
  await stale.getByTestId("slot-2027-08-10-10").click();
  await expect(stale.getByLabel("Your name")).toBeVisible();
});

test("a grid rendered for one name refuses to save once the cookie names someone else", async ({
  page,
  context,
}) => {
  await createRoom(page, { title: "Mismatch", startDate: "2027-08-11", endDate: "2027-08-11" });
  await joinRoom(page, "First");
  await paintAndWaitForSave(page, "slot-2027-08-11-9");

  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByText("Marking as First")).toBeVisible();
  // Switch identity in the second tab: "Not you?" then join as Second.
  await other.getByRole("button", { name: "Not you? Use a different name" }).click();
  await joinRoom(other, "Second");
  await expect(other.getByText("Marking as Second")).toBeVisible();

  // The first tab was rendered for First but the cookie now says Second:
  // the save is refused and the tab re-renders as Second, with First's
  // marks untouched (the cell is not green on Second's fresh grid).
  await page.getByTestId("slot-2027-08-11-10").click();
  await expect(page.getByText("Marking as Second")).toBeVisible();
  await expect(page.getByTestId("slot-2027-08-11-10")).not.toHaveClass(/bg-emerald/);
  await expect(page.getByTestId("slot-2027-08-11-9")).not.toHaveClass(/bg-emerald/);

  // And First's original mark is still there for First.
  await page.getByRole("button", { name: "Not you? Use a different name" }).click();
  await page.getByRole("button", { name: "First", exact: true }).click();
  await page.getByRole("button", { name: "Yes, that's me" }).click();
  await expect(page.getByTestId("slot-2027-08-11-9")).toHaveClass(/bg-emerald/);
});
