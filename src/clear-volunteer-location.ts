/**
 * Script to clear volunteer location cache
 * Run with: npx tsx src/clear-volunteer-location.ts
 */

import { PrismaClient } from "generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking volunteer locations...\n");

  const volunteers = await prisma.volunteerProfile.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  console.log(`Found ${volunteers.length} volunteer profiles:\n`);

  for (const vol of volunteers) {
    console.log(`Volunteer: ${vol.user.name || vol.user.email}`);
    console.log(`  Current Location: ${vol.latitude}, ${vol.longitude}`);
    console.log(`  Last Updated: ${vol.updatedAt}`);
    console.log(`  Available: ${vol.available}\n`);
  }

  // Ask if user wants to clear locations
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Do you want to clear all volunteer locations? (yes/no): ", async (answer: string) => {
    if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
      console.log("\n🧹 Clearing volunteer locations...");

      await prisma.volunteerProfile.updateMany({
        data: {
          latitude: null,
          longitude: null,
        },
      });

      console.log("✅ All volunteer locations cleared!");
      console.log("Volunteers will need to enable location tracking again.");
    } else {
      console.log("❌ Operation cancelled.");
    }

    rl.close();
    await prisma.$disconnect();
  });
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
