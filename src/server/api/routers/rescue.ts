import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const rescueRouter = createTRPCRouter({
  // Create a new rescue request (SOS) - USER only
  create: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, "Please describe your emergency"),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "USER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only users can create rescue requests",
        });
      }

      // Check if user already has an active rescue request
      const existingRequest = await ctx.db.rescueRequest.findFirst({
        where: {
          userId: ctx.session.user.id,
          status: {
            in: ["PENDING", "ASSIGNED", "IN_PROGRESS"],
          },
        },
      });

      if (existingRequest) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have an active rescue request",
        });
      }

      // Create the rescue request
      const rescueRequest = await ctx.db.rescueRequest.create({
        data: {
          userId: ctx.session.user.id,
          message: input.message,
          location: input.location,
          status: "PENDING",
        },
      });

      // Attempt to auto-assign a volunteer
      const assignmentResult = await autoAssignVolunteer(ctx.db, rescueRequest.id);

      // Return the updated request
      const updatedRequest = await ctx.db.rescueRequest.findUnique({
        where: { id: rescueRequest.id },
        include: {
          volunteer: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return {
        request: updatedRequest,
        assignmentResult,
      };
    }),

  // Get user's rescue requests - USER only
  getMyRequests: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "USER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only users can view their rescue requests",
      });
    }

    const requests = await ctx.db.rescueRequest.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        volunteer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests;
  }),

  // Get assigned rescue requests - VOLUNTEER only
  getAssignedToMe: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can view assigned requests",
      });
    }

    const requests = await ctx.db.rescueRequest.findMany({
      where: {
        volunteerId: ctx.session.user.id,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests;
  }),

  // Get pending requests for volunteers to accept
  getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can view pending requests",
      });
    }

    const requests = await ctx.db.rescueRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    return requests;
  }),

  // Volunteer accepts a rescue request
  acceptRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can accept rescue requests",
        });
      }

      const request = await ctx.db.rescueRequest.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rescue request not found",
        });
      }

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request is no longer pending",
        });
      }

      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: {
          volunteerId: ctx.session.user.id,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return updatedRequest;
    }),

  // Update request status - VOLUNTEER only
  updateStatus: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        status: z.enum(["IN_PROGRESS", "COMPLETED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can update rescue status",
        });
      }

      const request = await ctx.db.rescueRequest.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rescue request not found",
        });
      }

      if (request.volunteerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this request",
        });
      }

      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: {
          status: input.status,
          completedAt: input.status === "COMPLETED" ? new Date() : undefined,
        },
      });

      return updatedRequest;
    }),

  // Get escalated requests (NO_VOLUNTEER) - AUTHORITY only
  getEscalated: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view escalated requests",
      });
    }

    const requests = await ctx.db.rescueRequest.findMany({
      where: { status: "NO_VOLUNTEER" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { escalatedAt: "asc" }, // Oldest escalation first
    });

    return requests;
  }),

  // Get all requests for authority overview
  getAllRequests: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view all requests",
      });
    }

    const requests = await ctx.db.rescueRequest.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        volunteer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests;
  }),

  // Authority manually assigns a volunteer to an escalated request
  manualAssign: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        volunteerId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can manually assign volunteers",
        });
      }

      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: {
          volunteerId: input.volunteerId,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      });

      return updatedRequest;
    }),

  // Cancel a rescue request - USER only
  cancel: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.rescueRequest.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rescue request not found",
        });
      }

      if (request.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only cancel your own requests",
        });
      }

      await ctx.db.rescueRequest.delete({
        where: { id: input.requestId },
      });

      return { success: true };
    }),
});

/**
 * Auto-assign volunteer logic with NO_VOLUNTEER fallback
 */
async function autoAssignVolunteer(
  db: any,
  requestId: string
): Promise<{ assigned: boolean; message: string }> {
  // Try to find an available volunteer
  const availableVolunteer = await db.user.findFirst({
    where: {
      role: "VOLUNTEER",
      isAvailable: true,
      // Not already assigned to an active rescue
      volunteerAssignments: {
        none: {
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
      },
    },
  });

  if (availableVolunteer) {
    // Assign the volunteer
    await db.rescueRequest.update({
      where: { id: requestId },
      data: {
        volunteerId: availableVolunteer.id,
        status: "ASSIGNED",
        assignedAt: new Date(),
      },
    });

    console.log(`[RESCUE] Volunteer ${availableVolunteer.email} assigned to request ${requestId}`);

    // Mock SMS notification
    mockSendSMS(availableVolunteer.email, "New rescue request assigned to you!");

    return {
      assigned: true,
      message: `Volunteer ${availableVolunteer.name || availableVolunteer.email} has been assigned`,
    };
  } else {
    // NO VOLUNTEER FALLBACK
    await db.rescueRequest.update({
      where: { id: requestId },
      data: {
        status: "NO_VOLUNTEER",
        escalatedAt: new Date(),
      },
    });

    console.log(`[RESCUE] No volunteer available. Escalated to authorities. Request: ${requestId}`);

    // Mock emergency notification
    mockSendEmergencyAlert(requestId);

    return {
      assigned: false,
      message: "No volunteer available. Escalated to authorities.",
    };
  }
}

/**
 * Mock SMS notification (no external service)
 */
function mockSendSMS(recipient: string | null, message: string): void {
  console.log(`[MOCK SMS] To: ${recipient}`);
  console.log(`[MOCK SMS] Message: ${message}`);
}

/**
 * Mock emergency alert to authorities
 */
function mockSendEmergencyAlert(requestId: string): void {
  console.log(`[MOCK EMERGENCY] Alert sent to all authorities`);
  console.log(`[MOCK EMERGENCY] Request ID: ${requestId}`);
  console.log(`[MOCK EMERGENCY] Message: URGENT - User in danger with no available volunteers!`);
}
