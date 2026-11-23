// Sample data the `.states.tsx` files share, so every state shows the same room. Only the ui-kit page imports it
// (through the generated registry), so none of it reaches a production build; `build:check` verifies that.
import { computeResults } from "@/lib/results";
import { slotKey, type CellMark } from "@/lib/slots";

export const ROOM = { roomId: "ui-kit-sample-room", slug: "ui-kit-sample", participantId: "ui-kit-sample-anna" };
export const DATES = ["2027-03-12", "2027-03-13", "2027-03-14", "2027-03-15"];
export const HOURS = [17, 18, 19, 20, 21];
export const NAMES = ["Anna", "Boris", "Chiara"];

/** Anna's marks: free most evenings, prefers the weekend, can't make Monday late. */
export const MARKS: Record<string, CellMark> = {
  [slotKey(DATES[0], 18)]: { status: "CAN", preferred: false },
  [slotKey(DATES[0], 19)]: { status: "CAN", preferred: false },
  [slotKey(DATES[1], 18)]: { status: "CAN", preferred: true },
  [slotKey(DATES[1], 19)]: { status: "CAN", preferred: true },
  [slotKey(DATES[2], 17)]: { status: "CANNOT", preferred: false },
  [slotKey(DATES[3], 20)]: { status: "CANNOT", preferred: false },
  [slotKey(DATES[3], 21)]: { status: "CANNOT", preferred: false },
};

const row = (participantName: string, date: string, slotHour: number, status: "CAN" | "CANNOT", preferred = false) => ({
  participantName,
  slotDate: new Date(`${date}T00:00:00Z`),
  slotHour,
  status,
  preferred,
});

/** Three people: one slot suits everyone, others suit some. */
export const RESULTS = computeResults(DATES, HOURS, NAMES, [
  ...Object.entries(MARKS).map(([key, m]) => {
    const [date, hour] = key.split("T");
    return row("Anna", date, Number(hour), m.status, m.preferred);
  }),
  row("Boris", DATES[1], 18, "CAN"),
  row("Boris", DATES[1], 19, "CAN", true),
  row("Boris", DATES[0], 19, "CAN"),
  row("Chiara", DATES[1], 19, "CAN"),
  row("Chiara", DATES[0], 18, "CANNOT"),
]);
export const TOP_RESULTS = RESULTS.filter((r) => r.canCount > 0).slice(0, 10);
