import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom } from "./helpers";

// See fill-day.spec.ts for why this waits on the grid's own save-state
// indicator rather than a network matcher (avoids a real race under
// parallel-worker load between an unrelated/in-flight response and the
// specific save this action triggers).
async function clickAndWaitForSave(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText("Saved")).toBeHidden();
}

test("undo reverts the last stroke and persists it; redo reapplies and persists", async ({ page }) => {
  await createRoom(page, { title: "Undo Redo", startDate: "2027-04-01", endDate: "2027-04-01" });
  await joinRoom(page, "Iris");

  const undoButton = page.getByTestId("undo-button");
  const redoButton = page.getByTestId("redo-button");
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await clickAndWaitForSave(page, "slot-2027-04-01-9");
  await expect(page.getByTestId("slot-2027-04-01-9")).toHaveClass(/bg-emerald/);
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  await undoButton.click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByTestId("slot-2027-04-01-9")).not.toHaveClass(/bg-emerald/);
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeEnabled();

  // The revert itself round-tripped to the server, not just the local class.
  await page.reload();
  await expect(page.getByTestId("slot-2027-04-01-9")).not.toHaveClass(/bg-emerald/);

  await redoButton.click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByTestId("slot-2027-04-01-9")).toHaveClass(/bg-emerald/);
  await expect(redoButton).toBeDisabled();

  await page.reload();
  await expect(page.getByTestId("slot-2027-04-01-9")).toHaveClass(/bg-emerald/);
});

test("a new stroke after undo drops the redo stack", async ({ page }) => {
  await createRoom(page, { title: "Undo Redo Branch", startDate: "2027-04-01", endDate: "2027-04-01" });
  await joinRoom(page, "Iris");

  await clickAndWaitForSave(page, "slot-2027-04-01-9");
  await page.getByTestId("undo-button").click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByTestId("redo-button")).toBeEnabled();

  await clickAndWaitForSave(page, "slot-2027-04-01-10");
  await expect(page.getByTestId("redo-button")).toBeDisabled();
});

test("undo history persists across a reload, scoped to this room and name", async ({ page }) => {
  await createRoom(page, { title: "Undo Persist", startDate: "2027-04-01", endDate: "2027-04-02" });
  await joinRoom(page, "Iris");

  await clickAndWaitForSave(page, "slot-2027-04-01-9");
  await clickAndWaitForSave(page, "slot-2027-04-02-10");

  await page.reload();
  const undoButton = page.getByTestId("undo-button");
  await expect(undoButton).toBeEnabled();

  // Undoing after reload reverts the most recent stroke first (the second
  // slot), proving the stack order itself — not just its non-emptiness —
  // survived the reload.
  await undoButton.click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByTestId("slot-2027-04-02-10")).not.toHaveClass(/bg-emerald/);
  await expect(page.getByTestId("slot-2027-04-01-9")).toHaveClass(/bg-emerald/);
});
