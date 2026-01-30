import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const realtimeRouter = createTRPCRouter({
  // Get emergency channels and direct conversations
  getChannels: protectedProcedure
    .query(async ({ ctx }) => {
      const userRole = ctx.session.user.role;
      const userId = ctx.session.user.id;
      
      // Get public channels and role-based channels
      let channels = await ctx.db.realtimeChannel.findMany({
        where: { 
          isActive: true,
          OR: [
            { isPublic: true }, // Public channels like Emergency
            { 
              members: {
                some: {
                  userId: userId,
                  canRead: true,
                }
              }
            }
          ]
        },
        orderBy: { priority: 'asc' },
      });

      // If no channels exist, create default ones
      if (channels.length === 0) {
        await createDefaultChannels(ctx.db, userId, userRole);
        channels = await ctx.db.realtimeChannel.findMany({
          where: { 
            isActive: true,
            OR: [
              { isPublic: true },
              { 
                members: {
                  some: {
                    userId: userId,
                    canRead: true,
                  }
                }
              }
            ]
          },
          orderBy: { priority: 'asc' },
        });
      }

      // Get direct conversations
      const conversations = await ctx.db.directConversation.findMany({
        where: {
          OR: [
            { participant1: userId },
            { participant2: userId }
          ],
          isActive: true,
        },
        include: {
          user1: {
            select: { id: true, name: true, email: true, role: true }
          },
          user2: {
            select: { id: true, name: true, email: true, role: true }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Format conversations as channels
      const conversationChannels = conversations.map(conv => {
        const otherUser = conv.participant1 === userId ? conv.user2 : conv.user1;
        const lastMessage = conv.messages[0];
        
        return {
          id: `dm_${conv.id}`,
          name: `💬 ${otherUser.name || otherUser.email}`,
          type: "DIRECT_MESSAGE",
          description: lastMessage ? `Last: ${lastMessage.content.substring(0, 50)}...` : "Start a conversation",
          isActive: true,
          priority: 10,
          isDM: true,
          otherUser: otherUser,
          conversationId: conv.id,
        };
      });

      return [...channels, ...conversationChannels];
    }),

  // Get available users for direct messaging
  getAvailableUsers: protectedProcedure
    .query(async ({ ctx }) => {
      const userRole = ctx.session.user.role;
      const userId = ctx.session.user.id;

      // Users can message authorities and volunteers
      // Volunteers can message authorities and other volunteers
      // Authorities can message everyone
      let allowedRoles: string[] = [];
      
      if (userRole === "USER") {
        allowedRoles = ["AUTHORITY", "VOLUNTEER"];
      } else if (userRole === "VOLUNTEER") {
        allowedRoles = ["AUTHORITY", "VOLUNTEER"];
      } else if (userRole === "AUTHORITY") {
        allowedRoles = ["USER", "VOLUNTEER", "AUTHORITY"];
      }

      const users = await ctx.db.user.findMany({
        where: {
          role: { in: allowedRoles as any },
          id: { not: userId },
          profileCompleted: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' },
        ],
      });

      return users;
    }),

  // Start or get direct conversation
  startDirectConversation: protectedProcedure
    .input(z.object({
      otherUserId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      // Check if conversation already exists
      let conversation = await ctx.db.directConversation.findFirst({
        where: {
          OR: [
            { participant1: userId, participant2: input.otherUserId },
            { participant1: input.otherUserId, participant2: userId },
          ]
        }
      });

      // Create new conversation if doesn't exist
      if (!conversation) {
        conversation = await ctx.db.directConversation.create({
          data: {
            participant1: userId,
            participant2: input.otherUserId,
          }
        });
      }

      return conversation;
    }),

  // Send message to channel or direct conversation
  sendMessage: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      content: z.string().min(1).max(1000),
      messageType: z.enum(["TEXT", "LOCATION", "ALERT", "STATUS", "BROADCAST"]).default("TEXT"),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userRole = ctx.session.user.role;

      // Check if it's a direct message
      if (input.channelId.startsWith("dm_")) {
        const conversationId = input.channelId.replace("dm_", "");
        
        // Verify user is part of this conversation
        const conversation = await ctx.db.directConversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { participant1: userId },
              { participant2: userId }
            ]
          }
        });

        if (!conversation) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this conversation",
          });
        }

        // Create direct message
        const message = await ctx.db.directMessage.create({
          data: {
            conversationId: conversationId,
            senderId: userId,
            content: input.content,
            messageType: input.messageType,
            priority: input.priority,
            location: input.location ? JSON.stringify(input.location) : null,
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

        // Update conversation timestamp
        await ctx.db.directConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        return {
          ...message,
          senderName: message.sender.name || message.sender.email || "Anonymous",
          senderRole: message.sender.role,
          location: message.location ? JSON.parse(message.location) : null,
          timestamp: message.createdAt,
        };
      }

      // Handle channel messages
      const channel = await ctx.db.realtimeChannel.findUnique({
        where: { id: input.channelId },
        include: {
          members: {
            where: { userId: userId }
          }
        }
      });

      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found",
        });
      }

      // Check access permissions
      const hasAccess = channel.isPublic || 
        channel.members.some(m => m.userId === userId && m.canWrite) ||
        await hasChannelAccess(ctx.db, channel.type, userRole);

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this channel",
        });
      }

      // Create channel message
      const message = await ctx.db.realtimeMessage.create({
        data: {
          channelId: input.channelId,
          senderId: userId,
          content: input.content,
          messageType: input.messageType,
          priority: input.priority,
          location: input.location ? JSON.stringify(input.location) : null,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return {
        ...message,
        senderName: message.sender.name || message.sender.email || "Anonymous",
        senderRole: message.sender.role,
        location: message.location ? JSON.parse(message.location) : null,
        timestamp: message.createdAt,
      };
    }),

  // Get messages for a channel or direct conversation
  getChannelMessages: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      before: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userRole = ctx.session.user.role;

      // Handle direct messages
      if (input.channelId.startsWith("dm_")) {
        const conversationId = input.channelId.replace("dm_", "");
        
        // Verify access
        const conversation = await ctx.db.directConversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { participant1: userId },
              { participant2: userId }
            ]
          }
        });

        if (!conversation) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this conversation",
          });
        }

        const messages = await ctx.db.directMessage.findMany({
          where: {
            conversationId: conversationId,
            ...(input.before && {
              createdAt: {
                lt: new Date(input.before),
              },
            }),
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: input.limit + 1,
        });

        // Mark messages as read
        await ctx.db.directMessage.updateMany({
          where: {
            conversationId: conversationId,
            senderId: { not: userId },
            isRead: false,
          },
          data: { isRead: true }
        });

        const hasMore = messages.length > input.limit;
        const resultMessages = hasMore ? messages.slice(0, input.limit) : messages;

        return {
          messages: resultMessages.reverse().map(message => ({
            ...message,
            senderName: message.sender.name || message.sender.email || "Anonymous",
            senderRole: message.sender.role,
            location: message.location ? JSON.parse(message.location) : null,
            timestamp: message.createdAt,
          })),
          hasMore,
          nextCursor: hasMore ? resultMessages[resultMessages.length - 1]?.createdAt.toISOString() : null,
        };
      }

      // Handle channel messages
      const channel = await ctx.db.realtimeChannel.findUnique({
        where: { id: input.channelId },
        include: {
          members: {
            where: { userId: userId }
          }
        }
      });

      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found",
        });
      }

      // Check access permissions
      const hasAccess = channel.isPublic || 
        channel.members.some(m => m.userId === userId && m.canRead) ||
        await hasChannelAccess(ctx.db, channel.type, userRole);

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this channel",
        });
      }

      const messages = await ctx.db.realtimeMessage.findMany({
        where: {
          channelId: input.channelId,
          ...(input.before && {
            createdAt: {
              lt: new Date(input.before),
            },
          }),
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit + 1,
      });

      const hasMore = messages.length > input.limit;
      const resultMessages = hasMore ? messages.slice(0, input.limit) : messages;

      return {
        messages: resultMessages.reverse().map(message => ({
          ...message,
          senderName: message.sender.name || message.sender.email || "Anonymous",
          senderRole: message.sender.role,
          location: message.location ? JSON.parse(message.location) : null,
          timestamp: message.createdAt,
        })),
        hasMore,
        nextCursor: hasMore ? resultMessages[resultMessages.length - 1]?.createdAt.toISOString() : null,
      };
    }),

  // Get channel participants
  getChannelParticipants: protectedProcedure
    .input(z.object({
      channelId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Handle direct conversation participants
      if (input.channelId.startsWith("dm_")) {
        const conversationId = input.channelId.replace("dm_", "");
        const conversation = await ctx.db.directConversation.findUnique({
          where: { id: conversationId },
          include: {
            user1: { select: { id: true, name: true, email: true, role: true } },
            user2: { select: { id: true, name: true, email: true, role: true } },
          }
        });

        if (!conversation) {
          return { total: 0, online: 0, participants: [] };
        }

        const participants = [
          {
            ...conversation.user1,
            name: conversation.user1.name || conversation.user1.email || "Anonymous",
            isOnline: Math.random() > 0.3, // Mock online status
            lastSeen: new Date(),
          },
          {
            ...conversation.user2,
            name: conversation.user2.name || conversation.user2.email || "Anonymous",
            isOnline: Math.random() > 0.3, // Mock online status
            lastSeen: new Date(),
          },
        ];

        return {
          total: 2,
          online: participants.filter(p => p.isOnline).length,
          participants,
        };
      }

      // Handle channel participants (simplified for now)
      const recentMessages = await ctx.db.realtimeMessage.findMany({
        where: {
          channelId: input.channelId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        distinct: ['senderId'],
      });

      const participants = recentMessages.map(msg => ({
        id: msg.sender.id,
        name: msg.sender.name || msg.sender.email || "Anonymous",
        role: msg.sender.role,
        isOnline: Math.random() > 0.3, // Mock online status
        lastSeen: msg.createdAt,
      }));

      return {
        total: participants.length,
        online: participants.filter(p => p.isOnline).length,
        participants,
      };
    }),

  // Mark messages as read
  markChannelAsRead: protectedProcedure
    .input(z.object({
      channelId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.channelId.startsWith("dm_")) {
        const conversationId = input.channelId.replace("dm_", "");
        await ctx.db.directMessage.updateMany({
          where: {
            conversationId: conversationId,
            senderId: { not: userId },
            isRead: false,
          },
          data: { isRead: true }
        });
      }

      return { success: true };
    }),

  // Send emergency broadcast (authorities only)
  sendEmergencyBroadcast: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      message: z.string().min(1).max(1000),
      priority: z.enum(["HIGH", "CRITICAL"]),
      affectedArea: z.object({
        latitude: z.number(),
        longitude: z.number(),
        radiusKm: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can send emergency broadcasts",
        });
      }

      // Create emergency broadcast
      const broadcast = await ctx.db.emergencyBroadcast.create({
        data: {
          title: input.title,
          message: input.message,
          priority: input.priority,
          senderId: ctx.session.user.id,
          affectedArea: input.affectedArea ? JSON.stringify(input.affectedArea) : null,
        },
      });

      // Also create a message in the emergency channel
      const emergencyChannel = await ctx.db.realtimeChannel.findFirst({
        where: { type: "EMERGENCY" },
      });

      if (emergencyChannel) {
        await ctx.db.realtimeMessage.create({
          data: {
            channelId: emergencyChannel.id,
            senderId: ctx.session.user.id,
            content: `🚨 ${input.title}: ${input.message}`,
            messageType: "BROADCAST",
            priority: input.priority,
            isSystemMessage: true,
          },
        });
      }

      return broadcast;
    }),
});

// Helper functions
async function createDefaultChannels(db: any, userId: string, userRole: string) {
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
      description: "Direct line to emergency authorities",
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

  await db.realtimeChannel.createMany({ data: channels });

  // Create memberships for role-based channels
  const createdChannels = await db.realtimeChannel.findMany();
  
  for (const channel of createdChannels) {
    if (!channel.isPublic) {
      const allowedRoles = getChannelRoles(channel.type);
      if (allowedRoles.includes(userRole)) {
        await db.channelMembership.create({
          data: {
            channelId: channel.id,
            userId: userId,
            role: userRole,
          }
        });
      }
    }
  }
}

async function hasChannelAccess(db: any, channelType: string, userRole: string) {
  const allowedRoles = getChannelRoles(channelType);
  return allowedRoles.includes(userRole);
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