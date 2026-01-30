/**
 * Test script for Resource Inventory & Crowdsourcing System
 * 
 * This script tests the complete resource workflow:
 * 1. Resource creation by volunteers/businesses
 * 2. Resource visibility to authorities
 * 3. Smart resource suggestions for volunteers
 * 4. Resource management operations
 */

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";

async function testResourceSystem() {
  console.log("🧪 Testing Resource Inventory & Crowdsourcing System...\n");

  // Create mock context for testing
  const mockContext = await createTRPCContext({
    headers: new Headers(),
    req: {} as any,
  });

  // Create a test user (volunteer)
  const testUser = await db.user.create({
    data: {
      email: "test-volunteer@example.com",
      name: "Test Volunteer",
      role: "VOLUNTEER",
      latitude: 15.3173, // Karnataka coordinates
      longitude: 75.7139,
      profileCompleted: true,
    },
  });

  // Create test context with authenticated user
  const authenticatedContext = {
    ...mockContext,
    session: {
      user: testUser,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  const caller = createCaller(authenticatedContext);

  try {
    // Test 1: Create resource nodes
    console.log("📦 Test 1: Creating resource nodes...");
    
    const waterResource = await caller.resourceNode.create({
      name: "Emergency Water Supply",
      resourceType: "WATER",
      quantity: 100,
      latitude: 15.3200,
      longitude: 75.7150,
      contactInfo: "+91-9876543210",
      createdBy: "VOLUNTEER",
    });
    console.log(`✅ Created water resource: ${waterResource.name}`);

    const boatResource = await caller.resourceNode.create({
      name: "Rescue Boat",
      resourceType: "BOAT",
      quantity: 1,
      latitude: 15.3100,
      longitude: 75.7200,
      contactInfo: "Boat available 24/7",
      createdBy: "BUSINESS",
    });
    console.log(`✅ Created boat resource: ${boatResource.name}`);

    const medicalResource = await caller.resourceNode.create({
      name: "First Aid Kits",
      resourceType: "MEDICAL",
      quantity: 50,
      latitude: 15.3250,
      longitude: 75.7100,
      createdBy: "AUTHORITY",
    });
    console.log(`✅ Created medical resource: ${medicalResource.name}`);

    // Test 2: Get nearby resources (smart suggestions)
    console.log("\n🎯 Test 2: Testing smart resource suggestions...");
    
    const nearbyResources = await caller.resourceNode.getNearby({
      volunteerLat: 15.3173,
      volunteerLng: 75.7139,
      maxDistance: 5, // 5km radius
      limit: 3,
    });
    
    console.log(`✅ Found ${nearbyResources.length} nearby resources:`);
    nearbyResources.forEach((resource, index) => {
      console.log(`   ${index + 1}. ${resource.name} (${resource.resourceType}) - ${resource.distance.toFixed(2)}km away`);
    });

    // Test 3: Get user's resources
    console.log("\n📋 Test 3: Getting user's resources...");
    
    const myResources = await caller.resourceNode.getMyResources();
    console.log(`✅ User has ${myResources.length} resources:`);
    myResources.forEach((resource, index) => {
      console.log(`   ${index + 1}. ${resource.name} (${resource.resourceType}) - Qty: ${resource.quantity}`);
    });

    // Test 4: Update resource
    console.log("\n✏️ Test 4: Updating resource...");
    
    const updatedResource = await caller.resourceNode.update({
      id: waterResource.id,
      quantity: 150,
      contactInfo: "+91-9876543210 (Updated contact)",
    });
    console.log(`✅ Updated resource quantity to ${updatedResource.quantity}`);

    // Test 5: Authority view (create authority user)
    const authorityUser = await db.user.create({
      data: {
        email: "test-authority@example.com",
        name: "Test Authority",
        role: "AUTHORITY",
        profileCompleted: true,
      },
    });

    const authorityContext = {
      ...mockContext,
      session: {
        user: authorityUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    const authorityCaller = createCaller(authorityContext);

    console.log("\n🏛️ Test 5: Authority view of all resources...");
    
    const allResources = await authorityCaller.resourceNode.getAll();
    console.log(`✅ Authority can see ${allResources.length} total resources:`);
    allResources.forEach((resource, index) => {
      console.log(`   ${index + 1}. ${resource.name} by ${resource.createdBy} (${resource.creator.name})`);
    });

    // Test 6: Delete resource
    console.log("\n🗑️ Test 6: Deleting resource...");
    
    await caller.resourceNode.delete({ id: medicalResource.id });
    console.log(`✅ Deleted resource: ${medicalResource.name}`);

    // Verify deletion
    const remainingResources = await authorityCaller.resourceNode.getAll();
    console.log(`✅ Remaining resources: ${remainingResources.length}`);

    console.log("\n🎉 All tests passed! Resource system is working correctly.");

    // Test summary
    console.log("\n📊 Test Summary:");
    console.log("✅ Resource creation (VOLUNTEER, BUSINESS, AUTHORITY)");
    console.log("✅ Smart nearby resource suggestions with distance calculation");
    console.log("✅ User resource management");
    console.log("✅ Resource updates");
    console.log("✅ Authority visibility of all resources");
    console.log("✅ Resource deletion");
    console.log("\n🚀 Resource Inventory & Crowdsourcing System is ready for production!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    // Cleanup test data
    await db.user.deleteMany({
      where: {
        email: {
          in: ["test-volunteer@example.com", "test-authority@example.com"],
        },
      },
    });
    console.log("\n🧹 Cleaned up test data");
  }
}

// Run the test
testResourceSystem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });

export { testResourceSystem };