/**
 * Force clear and refresh volunteer location
 * Run with: npx tsx src/force-refresh-location.ts
 */

import { PrismaClient } from "generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Force refreshing volunteer locations...\n");

  // Clear all volunteer locations
  const result = await prisma.volunteerProfile.updateMany({
    data: {
      latitude: null,
      longitude: null,
    },
  });

  console.log(`✅ Cleared ${result.count} volunteer location(s)`);
  console.log("\n📍 Next steps:");
  console.log("1. Reload your volunteer page");
  console.log("2. Allow location permission when prompted");
  console.log("3. Wait for GPS to acquire (up to 30 seconds)");
  console.log("4. Check browser console for location logs");
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
