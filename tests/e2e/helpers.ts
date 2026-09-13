import type { Page } from "@playwright/test";

export type RoomFormOptions = {
  title: string;
  startDate: string;
  endDate: string;
  // G-004: one entry per line in the "Invited people" box.
  invitedNames?: string[];
  listedOnly?: boolean;
};

// Fills the landing page's create-room form without submitting it.
export async function fillRoomForm(page: Page, opts: RoomFormOptions): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Room name (optional)").fill(opts.title);
  await page.getByLabel("From", { exact: true }).fill(opts.startDate);
  await page.getByLabel("To", { exact: true }).fill(opts.endDate);
  // The timezone field defaults to a collapsed "<guessed zone> — Change"
  // label, not the raw <select>, so click through to reveal it first.
  await page.getByRole("button", { name: "Change" }).click();
  // Not "UTC": that alias isn't in every ICU's supportedValuesOf("timeZone")
  // list (confirmed absent from this machine's Node build), so the <select>
  // wouldn't have an option for it. Any real IANA zone works equally well
  // here since the app never converts stored slots through it (see D002).
  await page.getByLabel("Timezone", { exact: true }).selectOption("Europe/London");
  // The default preset is "Evening" (17:00-22:00); specs paint morning
  // slots, so pick "Whole day" (07:00-22:00) to keep those hours in range.
  await page.getByLabel("Whole day (07:00–22:00)").check();
  if (opts.invitedNames) {
    await page.getByLabel("Invited people").fill(opts.invitedNames.join("\n"));
  }
  if (opts.listedOnly) {
    await page.getByLabel("Only the invited names (you can always join)").check();
  }
}

export async function createRoom(page: Page, opts: RoomFormOptions): Promise<string> {
  await fillRoomForm(page, opts);
  await page.getByRole("button", { name: "Create room & get link" }).click();
  await page.waitForURL(/\/r\/[a-z0-9]+$/);
  const slug = new URL(page.url()).pathname.split("/r/")[1];
  return slug;
}

export async function joinRoom(page: Page, name: string): Promise<void> {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join room" }).click();
}

// Clicking a grid cell fires an async saveAvailability() server-action call
// after the pointer-up; waiting for the resulting POST is the deterministic
// way to know the mark actually persisted, rather than racing the transient
// "Saving…"/"Saved" UI text (which auto-hides after 1.5s).
export async function paintAndWaitForSave(page: Page, testId: string): Promise<void> {
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === "POST" && res.status() === 200),
    page.getByTestId(testId).click(),
  ]);
}
