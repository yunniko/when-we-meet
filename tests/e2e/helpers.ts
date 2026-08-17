import type { Page } from "@playwright/test";

export async function createRoom(
  page: Page,
  opts: { title: string; startDate: string; endDate: string },
): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Room name (optional)").fill(opts.title);
  await page.getByLabel("From", { exact: true }).fill(opts.startDate);
  await page.getByLabel("To", { exact: true }).fill(opts.endDate);
  // Not "UTC" — that alias isn't in every ICU's supportedValuesOf("timeZone")
  // list (confirmed absent from this machine's Node build), so the <select>
  // wouldn't have an option for it. Any real IANA zone works equally well
  // here since the app never converts stored slots through it (see D2) —
  // it's a display label.
  await page.getByLabel("Timezone", { exact: true }).selectOption("Europe/London");
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
