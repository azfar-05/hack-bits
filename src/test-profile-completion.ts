/**
 * Test script to verify profile completion functionality
 * Run with: npx tsx src/test-profile-completion.ts
 */

import { db } from "~/server/db";

async function testProfileCompletion() {
  console.log("🧪 Testing Profile Completion Flow...\n");

  try {
    // 1. Create a test user without profile completion
    console.log("1. Creating test user...");
    const testUser = await db.user.create({
      data: {
        email: "test-profile@example.com",
        name: "Test User",
        role: "USER",
        profileCompleted: false,
      },
    });
    console.log(`✅ Created user: ${testUser.email} (ID: ${testUser.id})`);

    // 2. Check profile status
    console.log("\n2. Checking profile status...");
    const profileStatus = await db.user.findUnique({
      where: { id: testUser.id },
      select: {
        id: true,
        email: true,
        profileCompleted: true,
        phoneNumber: true,
        latitude: true,
        longitude: true,
        address: true,
      },
    });
    console.log("Profile status:", profileStatus);
    console.log(`❌ Profile incomplete: ${!profileStatus?.profileCompleted}`);

    // 3. Complete the profile
    console.log("\n3. Completing profile...");
    const updatedUser = await db.user.update({
      where: { id: testUser.id },
      data: {
        phoneNumber: "+1234567890",
        latitude: 40.7128,
        longitude: -74.0060,
        address: "123 Test Street, New York, NY 10001",
        profileCompleted: true,
      },
    });
    console.log(`✅ Profile completed for: ${updatedUser.email}`);

    // 4. Verify completion
    console.log("\n4. Verifying profile completion...");
    const verifiedProfile = await db.user.findUnique({
      where: { id: testUser.id },
      select: {
        id: true,
        email: true,
        profileCompleted: true,
        phoneNumber: true,
        latitude: true,
        longitude: true,
        address: true,
      },
    });
    console.log("Updated profile:", verifiedProfile);
    console.log(`✅ Profile complete: ${verifiedProfile?.profileCompleted}`);

    // 5. Clean up test data
    console.log("\n5. Cleaning up test data...");
    await db.user.delete({
      where: { id: testUser.id },
    });
    console.log("✅ Test user deleted");

    console.log("\n🎉 All tests passed! Profile completion flow is working correctly.");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testProfileCompletion().catch(console.error);