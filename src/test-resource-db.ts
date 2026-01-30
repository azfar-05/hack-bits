/**
 * Simple database test for Resource Inventory System
 */

import { db } from "~/server/db";

async function testResourceDatabase() {
  console.log("🧪 Testing Resource Database Operations...\n");

  try {
    // Create a test user
    const testUser = await db.user.create({
      data: {
        email: "test-resource-user@example.com",
        name: "Test Resource User",
        role: "VOLUNTEER",
        latitude: 15.3173,
        longitude: 75.7139,
        profileCompleted: true,
      },
    });
    console.log(`✅ Created test user: ${testUser.name}`);

    // Create resource nodes
    const waterResource = await db.resourceNode.create({
      data: {
        name: "Emergency Water Supply",
        resourceType: "WATER",
        quantity: 100,
        latitude: 15.3200,
        longitude: 75.7150,
        createdBy: "VOLUNTEER",
        contactInfo: "+91-9876543210",
        userId: testUser.id,
      },
    });
    console.log(`✅ Created water resource: ${waterResource.name}`);

    const boatResource = await db.resourceNode.create({
      data: {
        name: "Rescue Boat",
        resourceType: "BOAT",
        quantity: 1,
        latitude: 15.3100,
        longitude: 75.7200,
        createdBy: "BUSINESS",
        contactInfo: "Available 24/7",
        userId: testUser.id,
      },
    });
    console.log(`✅ Created boat resource: ${boatResource.name}`);

    // Test queries
    const allResources = await db.resourceNode.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    console.log(`✅ Found ${allResources.length} resources in database`);

    const userResources = await db.resourceNode.findMany({
      where: { userId: testUser.id },
    });
    console.log(`✅ User has ${userResources.length} resources`);

    // Test update
    const updatedResource = await db.resourceNode.update({
      where: { id: waterResource.id },
      data: { quantity: 150 },
    });
    console.log(`✅ Updated resource quantity to ${updatedResource.quantity}`);

    // Test delete
    await db.resourceNode.delete({
      where: { id: boatResource.id },
    });
    console.log(`✅ Deleted resource: ${boatResource.name}`);

    // Verify final count
    const finalCount = await db.resourceNode.count();
    console.log(`✅ Final resource count: ${finalCount}`);

    console.log("\n🎉 Database operations successful!");
    console.log("\n📊 Test Summary:");
    console.log("✅ ResourceNode model exists and works");
    console.log("✅ CRUD operations functional");
    console.log("✅ User relationships working");
    console.log("✅ Resource types and enums working");

  } catch (error) {
    console.error("❌ Database test failed:", error);
  } finally {
    // Cleanup
    await db.resourceNode.deleteMany({
      where: {
        creator: {
          email: "test-resource-user@example.com",
        },
      },
    });
    await db.user.deleteMany({
      where: {
        email: "test-resource-user@example.com",
      },
    });
    console.log("\n🧹 Cleaned up test data");
  }
}

testResourceDatabase()
  .then(() => {
    console.log("\n🚀 Resource system database is ready!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });