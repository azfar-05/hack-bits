import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Search radius steps in kilometers
const SEARCH_RADII = [2, 5, 10];

/**
 * Haversine formula to calculate distance between two points
 * @returns distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const rescueRouter = createTRPCRouter({
  // Create a new rescue request (SOS) - USER only
  create: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, "Please describe your emergency"),
        location: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
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
          latitude: input.latitude,
          longitude: input.longitude,
          status: "PENDING",
        },
      });

      // Attempt to auto-assign a volunteer with radius expansion
      const assignmentResult = await autoAssignVolunteerWithRadius(
        ctx.db,
        rescueRequest.id,
        input.latitude,
        input.longitude
      );

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
      orderBy: { createdAt: "asc" },
    });

    return requests;
  }),

  // Get all rescue requests relevant to a volunteer (for polling/alert delivery)
  // Returns: requests assigned to this volunteer OR pending requests available for acceptance
  getForVolunteer: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can access this",
      });
    }

    const volunteerId = ctx.session.user.id;

    // Get requests assigned to this volunteer (any active status)
    const assignedRequests = await ctx.db.rescueRequest.findMany({
      where: {
        volunteerId,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get pending requests available for any volunteer
    const pendingRequests = await ctx.db.rescueRequest.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get NO_VOLUNTEER requests (escalated, but volunteer can still accept)
    const escalatedRequests = await ctx.db.rescueRequest.findMany({
      where: {
        status: "NO_VOLUNTEER",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { escalatedAt: "asc" },
    });

    return {
      assigned: assignedRequests,
      pending: pendingRequests,
      escalated: escalatedRequests,
      totalAlerts: assignedRequests.length + pendingRequests.length + escalatedRequests.length,
    };
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

      if (request.status !== "PENDING" && request.status !== "NO_VOLUNTEER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request is no longer available",
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
      orderBy: { escalatedAt: "asc" },
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

      // Verify volunteer exists and is a volunteer role
      const volunteer = await ctx.db.user.findFirst({
        where: {
          id: input.volunteerId,
          role: "VOLUNTEER",
        },
        include: {
          volunteerProfile: true,
        },
      });

      if (!volunteer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Volunteer not found",
        });
      }

      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: {
          volunteerId: input.volunteerId,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          volunteer: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      console.log(`[RESCUE] Authority manually assigned volunteer ${volunteer.email} to request ${input.requestId}`);
      mockSendSMS(volunteer.email, "You have been assigned to a rescue request by authorities!");

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
 * Auto-assign volunteer with radius expansion logic
 * Searches in expanding radii: 2km -> 5km -> 10km
 */
async function autoAssignVolunteerWithRadius(
  db: any,
  requestId: string,
  userLat?: number,
  userLon?: number
): Promise<{ assigned: boolean; message: string; radiusUsed?: number }> {
  // If no location provided, fall back to simple assignment
  if (!userLat || !userLon) {
    return await simpleAssignment(db, requestId);
  }

  // Get all available volunteers with location
  const availableVolunteers = await db.volunteerProfile.findMany({
    where: {
      available: true,
      latitude: { not: null },
      longitude: { not: null },
      user: {
        role: "VOLUNTEER",
        volunteerAssignments: {
          none: {
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          },
        },
      },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (availableVolunteers.length === 0) {
    return await escalateToAuthority(db, requestId, "No available volunteers with location tracking enabled");
  }

  // Calculate distances and sort by closest
  const volunteersWithDistance = availableVolunteers
    .map((v: any) => ({
      ...v,
      distance: haversineDistance(userLat, userLon, v.latitude!, v.longitude!),
    }))
    .sort((a: any, b: any) => a.distance - b.distance);

  // Try each radius step
  for (const radius of SEARCH_RADII) {
    const nearbyVolunteer = volunteersWithDistance.find((v: any) => v.distance <= radius);

    if (nearbyVolunteer) {
      // Assign the nearest volunteer within this radius
      await db.rescueRequest.update({
        where: { id: requestId },
        data: {
          volunteerId: nearbyVolunteer.user.id,
          status: "ASSIGNED",
          assignedAt: new Date(),
          searchRadiusUsed: radius,
        },
      });

      console.log(
        `[RESCUE] Volunteer ${nearbyVolunteer.user.email} assigned (${nearbyVolunteer.distance.toFixed(2)}km away, radius: ${radius}km)`
      );

      mockSendSMS(
        nearbyVolunteer.user.email,
        `New rescue request assigned! Distance: ${nearbyVolunteer.distance.toFixed(2)}km`
      );

      return {
        assigned: true,
        message: `Volunteer ${nearbyVolunteer.user.name || nearbyVolunteer.user.email} assigned (${nearbyVolunteer.distance.toFixed(1)}km away)`,
        radiusUsed: radius,
      };
    }

    console.log(`[RESCUE] No volunteer found within ${radius}km, expanding search...`);
  }

  // No volunteer found within 10km - escalate
  return await escalateToAuthority(db, requestId, "No volunteer available within 10km radius");
}

/**
 * Simple assignment without location (fallback)
 */
async function simpleAssignment(
  db: any,
  requestId: string
): Promise<{ assigned: boolean; message: string }> {
  const availableVolunteer = await db.user.findFirst({
    where: {
      role: "VOLUNTEER",
      volunteerProfile: {
        available: true,
      },
      volunteerAssignments: {
        none: {
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
      },
    },
  });

  if (availableVolunteer) {
    await db.rescueRequest.update({
      where: { id: requestId },
      data: {
        volunteerId: availableVolunteer.id,
        status: "ASSIGNED",
        assignedAt: new Date(),
      },
    });

    console.log(`[RESCUE] Volunteer ${availableVolunteer.email} assigned (no location data)`);
    mockSendSMS(availableVolunteer.email, "New rescue request assigned to you!");

    return {
      assigned: true,
      message: `Volunteer ${availableVolunteer.name || availableVolunteer.email} has been assigned`,
    };
  }

  return await escalateToAuthority(db, requestId, "No available volunteers");
}

/**
 * Escalate to authority when no volunteer found
 */
async function escalateToAuthority(
  db: any,
  requestId: string,
  reason: string
): Promise<{ assigned: boolean; message: string }> {
  await db.rescueRequest.update({
    where: { id: requestId },
    data: {
      status: "NO_VOLUNTEER",
      escalatedAt: new Date(),
    },
  });

  console.log(`[RESCUE] ${reason}. Escalated to authorities. Request: ${requestId}`);
  mockSendEmergencyAlert(requestId, reason);

  return {
    assigned: false,
    message: "No volunteer available. Escalated to authorities.",
  };
}

/**
 * Mock SMS notification
 */
function mockSendSMS(recipient: string | null, message: string): void {
  console.log(`[MOCK SMS] To: ${recipient}`);
  console.log(`[MOCK SMS] Message: ${message}`);
}

/**
 * Mock emergency alert to authorities
 */
function mockSendEmergencyAlert(requestId: string, reason: string): void {
  console.log(`[MOCK EMERGENCY] Alert sent to all authorities`);
  console.log(`[MOCK EMERGENCY] Request ID: ${requestId}`);
  console.log(`[MOCK EMERGENCY] Reason: ${reason}`);
  console.log(`[MOCK EMERGENCY] Message: URGENT - User in danger needs manual intervention!`);
}
