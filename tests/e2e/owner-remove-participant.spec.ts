import { test, expect, type Browser } from "@playwright/test";
import { createRoom, joinRoom, paintAndWaitForSave } from "./helpers";

// G-003: the room owner removes another participant after typing their
// name. Each extra participant joins from its own browser context, so
// cookies (and therefore identities) are genuinely separate.

async function joinAs(browser: Browser, url: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await joinRoom(page, name);
  await expect(page.getByText(`Marking as ${name}`)).toBeVisible();
  return { context, page };
}

test("owner removes a participant after typing their name; non-owners never see the panel", async ({
  page,
  browser,
}) => {
  await createRoom(page, { title: "Remove Flow", startDate: "2027-09-10", endDate: "2027-09-10" });
  await joinRoom(page, "Organizer");
  await expect(page.getByText("Marking as Organizer")).toBeVisible();

  const panel = page.getByRole("region", { name: "Participants" });
  await expect(panel.getByText("Organizer (you)")).toBeVisible();
  await expect(panel.getByText("Nobody else has joined yet.")).toBeVisible();

  const guest = await joinAs(browser, page.url(), "Guest Person");
  await paintAndWaitForSave(guest.page, "slot-2027-09-10-9");
  await expect(guest.page.getByRole("region", { name: "Participants" })).toHaveCount(0);

  await page.reload();
  await expect(panel.getByText("Guest Person", { exact: true })).toBeVisible();

  // Opening the confirmation deletes nothing; a partial name keeps the
  // destructive button disabled.
  await panel.getByRole("button", { name: "Remove Guest Person" }).click();
  await expect(panel.getByText("This deletes Guest Person and all their marks")).toBeVisible();
  const input = panel.getByLabel("Type “Guest Person” to confirm");
  const confirm = panel.getByRole("button", { name: "Yes, remove Guest Person" });
  await expect(confirm).toBeDisabled();
  await input.fill("Guest");
  await expect(confirm).toBeDisabled();

  // Cancel backs out with nothing changed.
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(input).toHaveCount(0);
  await expect(panel.getByText("Guest Person", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Remove Guest Person" })).toBeFocused();

  // Reopening starts empty; the name matches regardless of case and
  // surrounding spaces.
  await panel.getByRole("button", { name: "Remove Guest Person" }).click();
  await expect(input).toHaveValue("");
  await input.fill("  guest person ");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(panel.getByText("Guest Person", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Nobody else has joined yet.")).toBeVisible();
  await expect(page.getByText(/Also in this room/)).toHaveCount(0);

  // Their marks are gone from the results too.
  await page.getByRole("link", { name: "See results →" }).click();
  await expect(page.getByText("1 person")).toBeVisible();
  await expect(page.getByText("Guest Person")).toHaveCount(0);

  // The removed browser's grid is stale: its next save sends it to the
  // join form instead of pretending to save.
  await guest.page.getByTestId("slot-2027-09-10-10").click();
  await expect(guest.page.getByLabel("Your name")).toBeVisible();
  await guest.context.close();
});

test("the server refuses a wrong name, a target who already left, and a browser that stopped being the owner", async ({
  page,
  context,
  browser,
}) => {
  await createRoom(page, { title: "Remove Refusals", startDate: "2027-09-11", endDate: "2027-09-11" });
  await joinRoom(page, "Organizer");
  await expect(page.getByText("Marking as Organizer")).toBeVisible();
  const alice = await joinAs(browser, page.url(), "Alice");
  const bob = await joinAs(browser, page.url(), "Bob");
  await page.reload();
  const panel = page.getByRole("region", { name: "Participants" });

  // 1. A wrong name submitted anyway (a crafted request past the disabled
  //    button) is refused by the server, and Alice stays.
  await panel.getByRole("button", { name: "Remove Alice" }).click();
  await panel.getByLabel("Type “Alice” to confirm").fill("Alic");
  await panel.getByTestId("remove-confirm-form").evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(panel.getByText("The name you typed doesn't match.")).toBeVisible();
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(panel.getByText("Alice", { exact: true })).toBeVisible();

  // 2. Bob leaves while the owner is confirming: refused as not found, and
  //    the list refreshes without him.
  await panel.getByRole("button", { name: "Remove Bob" }).click();
  await panel.getByLabel("Type “Bob” to confirm").fill("Bob");
  await bob.page.getByRole("button", { name: "Leave the room" }).click();
  await bob.page.getByRole("button", { name: "Yes, delete my data" }).click();
  await expect(bob.page.getByLabel("Your name")).toBeVisible();
  await panel.getByRole("button", { name: "Yes, remove Bob" }).click();
  await expect(panel.getByText("Bob is no longer in this room.")).toBeVisible();
  await expect(panel.getByText("Bob", { exact: true })).toHaveCount(0);

  // 3. In another tab this browser switches to a different name, so it is
  //    no longer the owner: the still-open confirmation is refused and
  //    Alice stays in the room.
  await panel.getByRole("button", { name: "Remove Alice" }).click();
  await panel.getByLabel("Type “Alice” to confirm").fill("alice");
  const otherTab = await context.newPage();
  await otherTab.goto(page.url());
  await otherTab.getByRole("button", { name: "Not you? Use a different name" }).click();
  await joinRoom(otherTab, "Someone Else");
  await expect(otherTab.getByText("Marking as Someone Else")).toBeVisible();
  await panel.getByRole("button", { name: "Yes, remove Alice" }).click();
  await expect(
    panel.getByText("You're no longer this room's organizer. Reload the page."),
  ).toBeVisible();
  await expect(otherTab.getByRole("region", { name: "Participants" })).toHaveCount(0);
  await otherTab.reload();
  await expect(otherTab.getByText(/Also in this room:.*Alice/)).toBeVisible();

  await alice.context.close();
  await bob.context.close();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 393, height: 851 }, hasTouch: true, isMobile: true });

  test("the panel fits the screen with a long name and removal works by tap", async ({
    page,
    browser,
  }) => {
    const longName = "Maximilian-Alexander-von-Hohenzollern";
    await createRoom(page, { title: "Phone Remove", startDate: "2027-09-12", endDate: "2027-09-12" });
    await joinRoom(page, "Organizer");
    await expect(page.getByText("Marking as Organizer")).toBeVisible();
    const guest = await joinAs(browser, page.url(), longName);
    await page.reload();

    const panel = page.getByRole("region", { name: "Participants" });
    await panel.getByRole("button", { name: `Remove ${longName}` }).tap();
    await panel.getByLabel(`Type “${longName}” to confirm`).fill(longName);

    const fits = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
    expect(await fits()).toBe(true);

    await panel.getByRole("button", { name: `Yes, remove ${longName}` }).tap();
    await expect(panel.getByText("Nobody else has joined yet.")).toBeVisible();
    expect(await fits()).toBe(true);
    await guest.context.close();
  });
});
