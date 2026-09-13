import { test, expect } from "@playwright/test";
import en from "../../messages/en.json";
import { createRoom, fillRoomForm, joinRoom, paintAndWaitForSave } from "./helpers";

// G-004 M2: invited names at room creation, the "listed names only" join
// rule, and how invited-but-unjoined people show on the room and results
// pages. Each extra person uses their own browser context (own cookies).

test("listed-only room: invited names join by tapping, unlisted names are refused, the creator still gets in", async ({
  page,
  browser,
}) => {
  await createRoom(page, {
    title: "Invites Only",
    startDate: "2027-11-10",
    endDate: "2027-11-10",
    invitedNames: ["Anna", "Boris"],
    listedOnly: true,
  });
  await expect(page.getByText("Only invited names can join this room.")).toBeVisible();
  await expect(page.getByText("You created it, so you can join under any name.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anna", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Boris", exact: true })).toBeVisible();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(page.url());
  await expect(guest.getByText("Only invited names can join this room.")).toBeVisible();
  await expect(guest.getByText("You created it")).toHaveCount(0);

  // A name that isn't on the list is refused.
  await joinRoom(guest, "Mallory");
  await expect(guest.getByText("This room only accepts invited names")).toBeVisible();
  await expect(guest.getByText("Marking as Mallory")).toHaveCount(0);

  // Tapping an invited name claims it through "is this you?".
  await guest.getByRole("button", { name: "Anna", exact: true }).click();
  await expect(guest.getByText("Anna is on this room's invite list.")).toBeVisible();
  await guest.getByRole("button", { name: "Yes, that's me" }).click();
  await expect(guest.getByText("Marking as Anna")).toBeVisible();
  await expect(guest.getByText("Invited, not joined yet: Boris")).toBeVisible();
  await paintAndWaitForSave(guest, "slot-2027-11-10-9");

  // The browser that created the room may join under an unlisted name, and
  // it owns the room.
  await joinRoom(page, "Organizer");
  await expect(page.getByText("Marking as Organizer")).toBeVisible();
  const panel = page.getByRole("region", { name: "Participants" });
  await expect(panel).toBeVisible();
  await expect(page.getByText("Also in this room: Anna")).toBeVisible();
  await expect(page.getByText("Invited, not joined yet: Boris")).toBeVisible();
  await expect(panel.getByText("not joined yet", { exact: true })).toBeVisible();

  // Both joined people can make 09:00, but Boris hasn't joined, so the slot
  // isn't marked as "everyone".
  await paintAndWaitForSave(page, "slot-2027-11-10-9");
  await page.getByRole("link", { name: "See results →" }).click();
  await expect(page.getByText("2 of 3 people have joined.")).toBeVisible();
  await expect(page.getByText("Not joined yet: Boris")).toBeVisible();
  // Totals count joined people only: 2 of 2, not 2 of 3 with Boris.
  await expect(page.getByTestId("result-slot-2027-11-10-9")).toHaveAttribute("title", /^2\/2 can/);
  await expect(page.getByText(en.ResultsBoard.everyoneBadge, { exact: true })).toHaveCount(0);

  await guestContext.close();
});

test("a room open to anyone with the link keeps accepting new names alongside its invites", async ({
  page,
  browser,
}) => {
  await createRoom(page, {
    title: "Open Invites",
    startDate: "2027-11-11",
    endDate: "2027-11-11",
    invitedNames: ["Invitee"],
  });
  await expect(page.getByText("Only invited names can join this room.")).toHaveCount(0);

  const walkInContext = await browser.newContext();
  const walkIn = await walkInContext.newPage();
  await walkIn.goto(page.url());
  await joinRoom(walkIn, "Walk In");
  await expect(walkIn.getByText("Marking as Walk In")).toBeVisible();
  await expect(walkIn.getByText("Invited, not joined yet: Invitee")).toBeVisible();
  await walkInContext.close();
});

test("room creation rejects a listed-only room without names and an over-long name, keeps what was entered, and collapses duplicates", async ({
  page,
}) => {
  const createButton = page.getByRole("button", { name: "Create room & get link" });
  const invitedBox = page.getByLabel("Invited people");
  const listedOnly = page.getByLabel("Only the invited names (you can always join)");

  await fillRoomForm(page, {
    title: "Bad Invites",
    startDate: "2027-11-12",
    endDate: "2027-11-12",
    listedOnly: true,
  });
  await createButton.click();
  await expect(page.getByText("Add at least one invited name, or let anyone with the link join.")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(listedOnly).toBeChecked();

  const tooLong = `Fine Name\n${"x".repeat(61)}`;
  await invitedBox.fill(tooLong);
  await createButton.click();
  await expect(page.getByText("Each invited name can be at most 60 characters.")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // A failed submit keeps what was entered, and marks the field invalid.
  await expect(invitedBox).toHaveValue(tooLong);
  await expect(invitedBox).toHaveAttribute("aria-invalid", "true");
  await expect(listedOnly).toBeChecked();

  await invitedBox.fill("Fine Name\nfine name\nOther");
  await createButton.click();
  await page.waitForURL(/\/r\/[a-z0-9]+$/);
  await expect(page.getByText("Only invited names can join this room.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fine Name", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "fine name", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Other", exact: true })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 393, height: 851 }, hasTouch: true, isMobile: true });

  test("a long unbroken invited name wraps instead of widening the join, room and results pages", async ({
    page,
  }) => {
    const longName = "W".repeat(60);
    const fits = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    await createRoom(page, {
      title: "Long Names",
      startDate: "2027-11-13",
      endDate: "2027-11-13",
      invitedNames: [longName, "Short"],
    });
    await expect(page.getByRole("button", { name: longName, exact: true })).toBeVisible();
    expect(await fits()).toBe(true);

    await page.getByRole("button", { name: longName, exact: true }).tap();
    await expect(page.getByRole("button", { name: "Yes, that's me" })).toBeVisible();
    expect(await fits()).toBe(true);

    await page.getByRole("button", { name: "Yes, that's me" }).tap();
    await expect(page.getByText("Invited, not joined yet: Short")).toBeVisible();
    expect(await fits()).toBe(true);

    await page.getByRole("link", { name: "See results →" }).tap();
    await expect(page.getByText("Not joined yet: Short")).toBeVisible();
    expect(await fits()).toBe(true);
  });
});
