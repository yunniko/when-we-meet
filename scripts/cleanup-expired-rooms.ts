// Deletes rooms past their retention window (see lib/expiry.ts): 3 days
// after the creator's finalized meeting date, or 3 days after the planning
// range's end date if nothing was ever finalized. Room deletion cascades to
// its participants and their availability (see prisma/schema.prisma).
//
// The app also enforces this lazily on access (lib/room-access.ts) — an
// expired room 404s and is deleted the moment anyone tries to open it. This
// script exists for rooms nobody ever revisits, which would otherwise just
// sit in the database forever. Run it manually (`npm run cleanup`) or wire
// it into a host's scheduler / the `cleanup` docker-compose service.
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isRoomExpired } from "../lib/expiry";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const rooms = await prisma.room.findMany({
    select: { id: true, slug: true, endDate: true, selectedDate: true },
  });
  const now = new Date();
  const expired = rooms.filter((r) => isRoomExpired(r, now));

  if (expired.length > 0) {
    await prisma.room.deleteMany({ where: { id: { in: expired.map((r) => r.id) } } });
  }

  console.log(
    `Cleanup: removed ${expired.length} of ${rooms.length} room(s) checked.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
