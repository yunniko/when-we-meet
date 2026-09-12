import { devices, expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom } from "./helpers";

// Runs the grid on an emulated phone (touch + narrow viewport) and drives it
// with raw touch events through CDP, since Playwright's touchscreen API only
// taps. Covers the three touch gestures: swipe scrolls (and paints nothing),
// tap paints one cell, hold-then-drag paints a run of cells.
test.use({ ...devices["Pixel 5"] });

const CAN_CLASS = /bg-emerald/;

async function center(page: Page, testId: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("touch: swipe scrolls the days, tap paints one cell, hold-and-drag paints a run", async ({
  page,
}) => {
  // 31 days so the grid is far wider than the phone viewport.
  await createRoom(page, { title: "Touch", startDate: "2027-01-01", endDate: "2027-01-31" });
  await joinRoom(page, "Tanya");
  await expect(page.getByTestId("slot-2027-01-01-9")).toBeVisible();

  let posts = 0;
  page.on("request", (req) => {
    if (req.method() === "POST") posts++;
  });

  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });

  const scroller = page.getByTestId("grid-scroll");
  await scroller.scrollIntoViewIfNeeded();

  // 1. Swipe left across the grid: a scroll, not a stroke.
  const start = await center(page, "slot-2027-01-04-9");
  await touch("touchStart", [start]);
  for (let i = 1; i <= 6; i++) {
    await touch("touchMove", [{ x: start.x - i * 30, y: start.y }]);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(40);
  await page.waitForTimeout(400);
  await expect(page.getByTestId("slot-2027-01-04-9")).not.toHaveClass(CAN_CLASS);
  expect(posts).toBe(0);

  await scroller.evaluate((el) => {
    el.scrollLeft = 0;
  });

  // 2. Tap: paints exactly that cell and saves once.
  const tapAt = await center(page, "slot-2027-01-01-10");
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === "POST" && res.status() === 200),
    page.touchscreen.tap(tapAt.x, tapAt.y),
  ]);
  await expect(page.getByTestId("slot-2027-01-01-10")).toHaveClass(CAN_CLASS);
  await expect(page.getByTestId("slot-2027-01-02-10")).not.toHaveClass(CAN_CLASS);
  expect(posts).toBe(1);

  // 3. Tapping the same CAN cell with the CAN brush changes nothing: no save.
  await page.touchscreen.tap(tapAt.x, tapAt.y);
  await page.waitForTimeout(600);
  expect(posts).toBe(1);

  // 4. Hold, then drag across three days: one stroke, one save.
  const from = await center(page, "slot-2027-01-02-9");
  const to = await center(page, "slot-2027-01-04-9");
  await touch("touchStart", [from]);
  await page.waitForTimeout(400);
  const savePromise = page.waitForResponse(
    (res) => res.request().method() === "POST" && res.status() === 200,
  );
  await touch("touchMove", [{ x: (from.x + to.x) / 2, y: from.y }]);
  await page.waitForTimeout(16);
  await touch("touchMove", [to]);
  await page.waitForTimeout(16);
  await touch("touchEnd", []);
  await savePromise;
  for (const day of ["02", "03", "04"]) {
    await expect(page.getByTestId(`slot-2027-01-${day}-9`)).toHaveClass(CAN_CLASS);
  }
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  expect(posts).toBe(2);
});
