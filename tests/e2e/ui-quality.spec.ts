import { test, expect, type Page } from "@playwright/test";
import { createRoom, fillRoomForm, joinRoom, paintAndWaitForSave } from "./helpers";
import { expectNoSeriousA11yViolations } from "./ui-kit/axe";
import { expectStableLayout, expectUnmoved, recordLayoutShifts, resetLayoutShifts } from "./ui-kit/layout-shift";
import { expectMessagesFit } from "./ui-kit/message-fit";
import { MESSAGE_SLOTS } from "@/lib/message-slots";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import cs from "../../messages/cs.json";
import de from "../../messages/de.json";

// The UI standard's checks on every screen (COMPANY/UI_STANDARDS.md §5): no serious accessibility violation, no
// layout shift when a message appears or changes, and no console error (a hydration mismatch is otherwise silent:
// the page still works and every other spec stays green).

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("create form: accessible, and a refused submit moves nothing and focuses the field", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await recordLayoutShifts(page);
  await fillRoomForm(page, { title: "UI check", startDate: "2027-03-10", endDate: "2027-03-01" });
  await expectNoSeriousA11yViolations(page);

  await resetLayoutShifts(page);
  await page.getByRole("button", { name: "Create room & get link" }).click();
  await expect(page.getByText("The end date is before the start date")).toBeVisible();
  await expect(page.getByLabel("To", { exact: true })).toBeFocused();
  await expectStableLayout(page);
  await expectNoSeriousA11yViolations(page);
  expect(errors).toEqual([]);
});

test("join form, grid, results and dialogs: accessible, and saving moves nothing", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await recordLayoutShifts(page);
  const slug = await createRoom(page, { title: "UI check", startDate: "2027-03-01", endDate: "2027-03-02" });
  await expectNoSeriousA11yViolations(page);

  await joinRoom(page, "Checker");
  await expect(page.getByText("Marking as Checker")).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await resetLayoutShifts(page);
  await paintAndWaitForSave(page, "slot-2027-03-01-9");
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText("Saved")).toBeHidden();
  await expectStableLayout(page);

  // The grid's detail opens on demand, in the top layer.
  await resetLayoutShifts(page);
  await page.getByRole("button", { name: "How to mark" }).click();
  await expect(page.getByText(/Prefer. only applies/)).toBeVisible();
  await expectStableLayout(page);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeFocused();

  await page.goto(`/r/${slug}/results`);
  await expect(page.getByRole("heading", { name: "Best times" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  expect(errors).toEqual([]);
});

test("the kit's kitchen sink renders under next dev with this project's tokens", async ({ page }) => {
  // A development-only page (app/dev/ui-kit/page.dev.tsx); `npm run build:check` proves no build contains it.
  const errors = collectConsoleErrors(page);
  await page.goto("/dev/ui-kit");
  await expect(page.locator("[data-ui-kit-sink]")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  expect(errors).toEqual([]);
});

// The shift API only sees the viewport, and the focus() after a refused submit scrolls: compare positions instead,
// at phone width where a message is likeliest to wrap. Every locale, since German and Russian run longest.
for (const locale of ["en", "ru", "cs", "de"]) {
  test(`create form at 390px (${locale}): a refused submit moves nothing below the fields`, async ({ page, context }) => {
    await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:30099" }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator('input[name="title"]').fill("UI check");
    await page.locator('input[name="startDate"]').fill("2027-03-10");
    await page.locator('input[name="endDate"]').fill("2027-03-01");
    const below = ['textarea[name="invitedNames"]', 'button[type="submit"]'];
    await expectUnmoved(page, below, () =>
      page
        .locator('button[type="submit"]')
        .click()
        .then(() => page.locator('[aria-invalid="true"]').first().waitFor())
    );
  });
}

// Every message a slot reserves space for fits one line on the narrowest common phone, in every language: the
// slot is then one line tall and nothing waits empty below a field (ui-kit D007). Measured in the create form's
// invited-names slot, the narrowest full-width slot; a name inside a message is counted as empty.
type Catalog = { [key: string]: string | Catalog };
const catalogs: Record<string, Catalog> = { en, ru, cs, de };
const lookup = (catalog: Catalog, path: string) =>
  path.split(".").reduce<unknown>((node, part) => (node as Catalog)[part], catalog) as string;

for (const [locale, catalog] of Object.entries(catalogs)) {
  test(`every reserved message fits one line at 360px, ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    const slot = page.locator(`#${await page.locator('textarea[name="invitedNames"]').getAttribute("aria-describedby")}`);
    const messages = Object.entries(MESSAGE_SLOTS).flatMap(([namespace, slots]) =>
      Object.values(slots)
        .flat()
        .map((key) =>
          lookup(catalog, `${namespace}.${key}`)
            .replace(/\{max\}/g, "100")
            .replace(/\{\w+\}/g, "")
        )
    );
    expect(messages.length).toBeGreaterThan(40);
    await expectMessagesFit(slot, messages);
  });
}
