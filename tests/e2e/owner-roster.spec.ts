import { test, expect, type Browser, type Page } from "@playwright/test";
import { createRoom, joinRoom, paintAndWaitForSave } from "./helpers";

// G-004 M3: the owner edits the invited list and the join rule from the
// Participants panel, and a listed-only leave keeps the name, which the
// owner sees marked as having left (D013). Each extra person has their own
// browser context, so their cookies are separate.

const serverActionDone = (page: Page) =>
  page.waitForResponse((res) => res.request().method() === "POST" && res.status() === 200);

async function visitorAt(browser: Browser, url: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}

async function claim(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Yes, that's me" }).click();
  await expect(page.getByText(`Marking as ${name}`)).toBeVisible();
}

test("owner adds names, removes an unclaimed one in one click, and switches who can join", async ({
  page,
  browser,
}) => {
  await createRoom(page, { title: "Roster", startDate: "2027-12-01", endDate: "2027-12-01" });
  await joinRoom(page, "Organizer");
  await expect(page.getByText("Marking as Organizer")).toBeVisible();
  const panel = page.getByRole("region", { name: "Participants" });
  const addBox = panel.getByLabel("Add invited names");

  await addBox.fill("Dana\nEli\norganizer");
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.getByText("Added 2 names.")).toBeVisible();
  await expect(panel.getByText("Already in the room: Organizer")).toBeVisible();
  await expect(addBox).toHaveValue("");
  await expect(panel.getByRole("listitem").filter({ hasText: "Dana" })).toContainText("not joined yet");
  await expect(panel.getByText("Eli", { exact: true })).toBeVisible();

  // An unclaimed name goes in one click: nothing to type, nothing lost.
  await panel.getByRole("button", { name: "Remove Eli" }).click();
  await expect(panel.getByText("Eli", { exact: true })).toHaveCount(0);
  await expect(panel.getByTestId("remove-confirm-form")).toHaveCount(0);

  // Only names on the list: a stranger's own name is refused, a listed one works.
  await Promise.all([serverActionDone(page), panel.getByLabel("Only names on this list").check()]);
  const guest = await visitorAt(browser, page.url());
  await expect(guest.page.getByText("Only invited names can join this room.")).toBeVisible();
  await joinRoom(guest.page, "Mallory");
  await expect(guest.page.getByText("This room only accepts invited names")).toBeVisible();
  await claim(guest.page, "Dana");

  // Back to anyone with the link: a new name can join again.
  await Promise.all([
    serverActionDone(page),
    panel.getByLabel("Anyone with the link can add their name").check(),
  ]);
  const walkIn = await visitorAt(browser, page.url());
  await joinRoom(walkIn.page, "Walk In");
  await expect(walkIn.page.getByText("Marking as Walk In")).toBeVisible();

  await guest.context.close();
  await walkIn.context.close();
});

test("removing an invited name someone claimed meanwhile asks for the typed confirmation instead", async ({
  page,
  browser,
}) => {
  await createRoom(page, {
    title: "Claimed Meanwhile",
    startDate: "2027-12-02",
    endDate: "2027-12-02",
    invitedNames: ["Fay"],
    listedOnly: true,
  });
  await joinRoom(page, "Organizer");
  const panel = page.getByRole("region", { name: "Participants" });
  await expect(panel.getByRole("listitem").filter({ hasText: "Fay" })).toContainText("not joined yet");

  const guest = await visitorAt(browser, page.url());
  await claim(guest.page, "Fay");
  await paintAndWaitForSave(guest.page, "slot-2027-12-02-9");

  // The owner's list is stale and still shows Fay as not joined.
  await panel.getByRole("button", { name: "Remove Fay" }).click();
  const claimedNotice = panel.getByText("Fay has just joined. Type their name below to remove them.");
  await expect(claimedNotice).toBeVisible();
  await expect(panel.getByLabel("Type “Fay” to confirm")).toBeVisible();
  await expect(panel.getByRole("listitem").filter({ hasText: "Fay" })).not.toContainText("not joined yet");

  // The refused one-click removal deleted nothing: Fay's mark is still there.
  await guest.page.reload();
  await expect(guest.page.getByTestId("slot-2027-12-02-9")).toHaveClass(/bg-emerald/);

  // Cancel clears the instruction along with the confirmation.
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(claimedNotice).toHaveCount(0);

  // Removing Fay now takes the typed confirmation.
  await panel.getByRole("button", { name: "Remove Fay" }).click();
  await panel.getByLabel("Type “Fay” to confirm").fill("Fay");
  await panel.getByRole("button", { name: "Yes, remove Fay" }).click();
  await expect(panel.getByText("Fay", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Fay has just joined")).toHaveCount(0);

  await guest.context.close();
});

test("leaving a listed-only room keeps the name on the list, and the owner sees that the person left", async ({
  page,
  browser,
}) => {
  await createRoom(page, {
    title: "Leaving",
    startDate: "2027-12-03",
    endDate: "2027-12-03",
    invitedNames: ["Gus", "Hana"],
    listedOnly: true,
  });
  await joinRoom(page, "Organizer");
  await expect(page.getByText("Marking as Organizer")).toBeVisible();

  const guest = await visitorAt(browser, page.url());
  await claim(guest.page, "Gus");
  await paintAndWaitForSave(guest.page, "slot-2027-12-03-9");

  await guest.page.getByRole("button", { name: "Leave the room" }).click();
  await expect(guest.page.getByText("Your name stays on the invite list")).toBeVisible();
  await guest.page.getByRole("button", { name: "Yes, delete my marks" }).click();
  await expect(guest.page.getByLabel("Your name")).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Gus", exact: true })).toBeVisible();

  // The owner sees that Gus left, and that Hana never joined.
  await page.reload();
  const panel = page.getByRole("region", { name: "Participants" });
  const gusRow = panel.getByRole("listitem").filter({ hasText: "Gus" });
  await expect(gusRow).toContainText("left the room");
  await expect(panel.getByRole("listitem").filter({ hasText: "Hana" })).toContainText("not joined yet");

  // Claiming the name again starts fresh: the old mark and the tag are gone.
  await claim(guest.page, "Gus");
  await expect(guest.page.getByTestId("slot-2027-12-03-9")).not.toHaveClass(/bg-emerald/);
  await page.reload();
  await expect(gusRow).not.toContainText("left the room");

  await guest.context.close();
});

test("a leave confirmed after the owner changed the rule is refused and shows the new warning", async ({
  page,
  browser,
}) => {
  await createRoom(page, { title: "Rule Changed", startDate: "2027-12-04", endDate: "2027-12-04" });
  await joinRoom(page, "Organizer");
  await expect(page.getByText("Marking as Organizer")).toBeVisible();

  const guest = await visitorAt(browser, page.url());
  await joinRoom(guest.page, "Ida");
  await expect(guest.page.getByText("Marking as Ida")).toBeVisible();

  // Ida opens the leave confirmation under "anyone can join"...
  await guest.page.getByRole("button", { name: "Leave the room" }).click();
  await expect(guest.page.getByText("This deletes your name and all your marks")).toBeVisible();

  // ...then the owner switches to listed names only before Ida confirms.
  const panel = page.getByRole("region", { name: "Participants" });
  await Promise.all([serverActionDone(page), panel.getByLabel("Only names on this list").check()]);

  await guest.page.getByRole("button", { name: "Yes, delete my data" }).click();
  await expect(guest.page.getByText("The room's settings just changed.")).toBeVisible();
  await expect(guest.page.getByText("Your name stays on the invite list")).toBeVisible();
  await expect(guest.page.getByText("Marking as Ida")).toBeVisible();

  // Confirming the new warning resets the name instead of deleting it.
  await guest.page.getByRole("button", { name: "Yes, delete my marks" }).click();
  await expect(guest.page.getByLabel("Your name")).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Ida", exact: true })).toBeVisible();

  await guest.context.close();
});
