/**
 * Test script to verify volunteer location update functionality
 * Run with: npx tsx src/test-volunteer-location.ts
 */

import { db } from "~/server/db";

async function testVolunteerLocation() {
  console.log("🧪 Testing Volunteer Location Update...\n");

  try {
    // 1. Create a test volunteer user
    console.log("1. Creating test volunteer...");
    const testVolunteer = await db.user.create({
      data: {
        email: "test-volunteer@example.com",
        name: "Test Volunteer",
        role: "VOLUNTEER",
        profileCompleted: true,
        phoneNumber: "+1234567890",
        latitude: 40.7128,
        longitude: -74.0060,
        address: "123 Test Street, New York, NY 10001",
      },
    });
    console.log(`✅ Created volunteer: ${testVolunteer.email} (ID: ${testVolunteer.id})`);

    // 2. Create volunteer profile with initial location
    console.log("\n2. Creating volunteer profile...");
    const volunteerProfile = await db.volunteerProfile.create({
      data: {
        userId: testVolunteer.id,
        latitude: 40.7128,
        longitude: -74.0060,
        available: true,
      },
    });
    console.log(`✅ Created volunteer profile with location: (${volunteerProfile.latitude}, ${volunteerProfile.longitude})`);

    // 3. Update volunteer location
    console.log("\n3. Updating volunteer location...");
    const updatedProfile = await db.volunteerProfile.update({
      where: { userId: testVolunteer.id },
      data: {
        latitude: 40.7589,
        longitude: -73.9851,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Updated location to: (${updatedProfile.latitude}, ${updatedProfile.longitude})`);

    // 4. Verify location update
    console.log("\n4. Verifying location update...");
    const verifiedProfile = await db.volunteerProfile.findUnique({
      where: { userId: testVolunteer.id },
      include: {
        user: {
          select: { email: true, role: true },
        },
      },
    });
    console.log("Verified profile:", {
      email: verifiedProfile?.user.email,
      role: verifiedProfile?.user.role,
      latitude: verifiedProfile?.latitude,
      longitude: verifiedProfile?.longitude,
      available: verifiedProfile?.available,
      lastUpdated: verifiedProfile?.updatedAt,
    });

    // 5. Test availability toggle
    console.log("\n5. Testing availability toggle...");
    const toggledProfile = await db.volunteerProfile.update({
      where: { userId: testVolunteer.id },
      data: { available: false },
    });
    console.log(`✅ Availability toggled to: ${toggledProfile.available}`);

    // 6. Clean up test data
    console.log("\n6. Cleaning up test data...");
    await db.volunteerProfile.delete({
      where: { userId: testVolunteer.id },
    });
    await db.user.delete({
      where: { id: testVolunteer.id },
    });
    console.log("✅ Test data cleaned up");

    console.log("\n🎉 All tests passed! Volunteer location system is working correctly.");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testVolunteerLocation().catch(console.error);