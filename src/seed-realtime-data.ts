import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function seedRealtimeData() {
  console.log("🚀 Seeding real-time communication data...");

  try {
    // Clear existing data
    await prisma.directMessage.deleteMany();
    await prisma.directConversation.deleteMany();
    await prisma.channelMembership.deleteMany();
    await prisma.realtimeMessage.deleteMany();
    await prisma.realtimeChannel.deleteMany();

    // Create default channels with proper access control
    const channels = [
      {
        name: "🚨 Emergency Alert",
        type: "EMERGENCY" as const,
        description: "Live emergency updates and coordination",
        priority: 1,
        isPublic: true, // Everyone can see emergency alerts
      },
      {
        name: "👮 Contact Authorities",
        type: "AUTHORITY" as const,
        description: "Messages sent here are only visible to authorities",
        priority: 2,
        isPublic: false, // Only authorities can see these messages
      },
      {
        name: "🤝 Volunteer Coordination",
        type: "VOLUNTEER" as const,
        description: "Coordinate with active volunteers",
        priority: 3,
        isPublic: false, // Only volunteers and authorities
      },
      {
        name: "🎯 Command Center",
        type: "COMMAND" as const,
        description: "Authority-only command and control",
        priority: 2,
        isPublic: false, // Only authorities
      },
      {
        name: "💬 Community Support",
        type: "GENERAL" as const,
        description: "General community discussion",
        priority: 4,
        isPublic: true, // Everyone can participate
      },
    ];

    console.log("📝 Creating channels...");
    const createdChannels = await Promise.all(
      channels.map(channel => 
        prisma.realtimeChannel.create({ data: channel })
      )
    );

    console.log(`✅ Created ${createdChannels.length} channels`);

    // Get or create system user
    let systemUser = await prisma.user.findFirst({
      where: { email: "system@emergency.local" }
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: "system@emergency.local",
          name: "Emergency System",
          role: "AUTHORITY",
          profileCompleted: true,
        }
      });
    }

    // Create sample users for testing
    const testUsers = [
      {
        email: "authority@test.com",
        name: "Fire Chief Johnson",
        role: "AUTHORITY" as const,
        profileCompleted: true,
      },
      {
        email: "volunteer@test.com", 
        name: "Volunteer Mike",
        role: "VOLUNTEER" as const,
        profileCompleted: true,
      },
      {
        email: "user@test.com",
        name: "Sarah Chen",
        role: "USER" as const,
        profileCompleted: true,
      },
    ];

    console.log("👥 Creating test users...");
    const createdUsers = await Promise.all(
      testUsers.map(async (userData) => {
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email }
        });
        
        if (existingUser) {
          return existingUser;
        }
        
        return prisma.user.create({ data: userData });
      })
    );

    console.log(`✅ Created/found ${createdUsers.length} test users`);

    // Create channel memberships for role-based access
    console.log("🔐 Setting up channel access...");
    const allUsers = [systemUser, ...createdUsers];
    
    for (const channel of createdChannels) {
      if (!channel.isPublic) {
        const allowedRoles = getChannelRoles(channel.type);
        
        for (const user of allUsers) {
          if (allowedRoles.includes(user.role)) {
            await prisma.channelMembership.create({
              data: {
                channelId: channel.id,
                userId: user.id,
                role: user.role,
              }
            });
          }
        }
      }
    }

    // Create sample messages for emergency channel
    const emergencyChannel = createdChannels.find(c => c.type === "EMERGENCY");
    if (emergencyChannel && systemUser) {
      const sampleMessages = [
        {
          channelId: emergencyChannel.id,
          senderId: systemUser.id,
          content: "🚨 Emergency communication system is now active. All messages are monitored by authorities.",
          messageType: "ALERT" as const,
          priority: "HIGH" as const,
          isSystemMessage: true,
        },
        {
          channelId: emergencyChannel.id,
          senderId: systemUser.id,
          content: "FLASH FLOOD WARNING: Downtown area evacuation in progress. Use Highway 101 North as primary evacuation route.",
          messageType: "BROADCAST" as const,
          priority: "CRITICAL" as const,
          isSystemMessage: true,
        },
      ];

      console.log("💬 Creating sample messages...");
      await Promise.all(
        sampleMessages.map(message => 
          prisma.realtimeMessage.create({ data: message })
        )
      );

      console.log(`✅ Created ${sampleMessages.length} sample messages`);
    }

    // Create a sample direct conversation
    const authorityUser = createdUsers.find(u => u.role === "AUTHORITY");
    const regularUser = createdUsers.find(u => u.role === "USER");
    
    if (authorityUser && regularUser) {
      console.log("💬 Creating sample direct conversation...");
      const conversation = await prisma.directConversation.create({
        data: {
          participant1: regularUser.id,
          participant2: authorityUser.id,
        }
      });

      // Add sample direct messages
      const directMessages = [
        {
          conversationId: conversation.id,
          senderId: regularUser.id,
          content: "Hello, I need help with evacuation from downtown area. Can you assist?",
          messageType: "TEXT" as const,
          priority: "HIGH" as const,
        },
        {
          conversationId: conversation.id,
          senderId: authorityUser.id,
          content: "Yes, I can help. What's your exact location? We have rescue teams in the area.",
          messageType: "TEXT" as const,
          priority: "NORMAL" as const,
        },
      ];

      await Promise.all(
        directMessages.map(message => 
          prisma.directMessage.create({ data: message })
        )
      );

      console.log(`✅ Created sample direct conversation with ${directMessages.length} messages`);
    }

    console.log("🎉 Real-time communication data seeded successfully!");

  } catch (error) {
    console.error("❌ Error seeding real-time data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getChannelRoles(channelType: string): string[] {
  switch (channelType) {
    case "EMERGENCY":
    case "GENERAL":
      return ["USER", "VOLUNTEER", "AUTHORITY"];
    case "AUTHORITY":
      return ["AUTHORITY"];
    case "VOLUNTEER":
      return ["VOLUNTEER", "AUTHORITY"];
    case "COMMAND":
      return ["AUTHORITY"];
    default:
      return [];
  }
}

// Run the seeding function
seedRealtimeData()
  .then(() => {
    console.log("✨ Seeding completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seeding failed:", error);
    process.exit(1);
  });