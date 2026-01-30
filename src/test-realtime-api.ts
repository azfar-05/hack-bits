import { api } from "~/trpc/server";

async function testRealtimeAPI() {
  try {
    console.log("🧪 Testing Real-time API...");

    // Test if the realtime router is accessible
    console.log("Available routers:", Object.keys(api));
    
    // Check if realtime router exists
    if ('realtime' in api) {
      console.log("✅ Realtime router found");
      console.log("Realtime methods:", Object.keys(api.realtime));
    } else {
      console.log("❌ Realtime router NOT found");
    }

  } catch (error) {
    console.error("❌ Error testing realtime API:", error);
  }
}

testRealtimeAPI();