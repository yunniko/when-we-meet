import { test, expect } from "@playwright/test";
import { createRoom, joinRoom } from "./helpers";

test("joining an existing name prompts to confirm, and claiming it works", async ({ browser, page }) => {
  const slug = await createRoom(page, {
    title: "Collision Room",
    startDate: "2027-02-10",
    endDate: "2027-02-10",
  });

  // First visitor joins as "Sam".
  await joinRoom(page, "Sam");
  await expect(page.getByText("Marking as Sam")).toBeVisible();

  // A second, cookie-less visitor (fresh browser context, no shared cookies)
  // tries the same name.
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(`/r/${slug}`);
  await joinRoom(page2, "Sam");

  await expect(page2.getByText(/already has marks in this room/)).toBeVisible();
  await expect(page2.getByText("Is this you?")).toBeVisible();

  await page2.getByRole("button", { name: "Yes, that's me" }).click();
  await expect(page2.getByText("Marking as Sam")).toBeVisible();

  await context2.close();
});

test("declining the collision prompt lets a visitor pick a different name", async ({ browser, page }) => {
  const slug = await createRoom(page, {
    title: "Collision Room 2",
    startDate: "2027-02-11",
    endDate: "2027-02-11",
  });

  await joinRoom(page, "Jordan");
  await expect(page.getByText("Marking as Jordan")).toBeVisible();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(`/r/${slug}`);
  await joinRoom(page2, "Jordan");
  await expect(page2.getByText("Is this you?")).toBeVisible();

  await page2.getByRole("button", { name: "No, use a different name" }).click();
  await expect(page2.getByLabel("Your name")).toBeVisible();
  await joinRoom(page2, "Jordan's Friend");
  await expect(page2.getByText("Marking as Jordan's Friend")).toBeVisible();

  await context2.close();
});
