import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { predictResponseTime, type ETAInputs } from "~/lib/eta-prediction";

// Search radius steps in kilometers
const SEARCH_RADII = [2, 5, 10];

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const rescueRouter = createTRPCRouter({
  // Create a new rescue request (SOS) - USER only
  create: protectedProcedure
    .input(
      z.object({
        message: z.string().optional(), // Optional for panic-first SOS
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
          message: input.message ?? "Emergency SOS", // Default message for panic-first SOS
          location: input.location,
          latitude: input.latitude,
          longitude: input.longitude,
          status: "PENDING",
        },
      });

      return rescueRequest;
    }),

  // Public SOS endpoint for emergency situations (no authentication required)
  createSOS: publicProcedure
    .input(
      z.object({
        message: z.string().optional(),
        location: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        phoneNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create a temporary user for this SOS if needed
      // For now, we'll create the request without user association
      // In production, you might want to create a temporary user record
      
      // Create the rescue request
      const rescueRequest = await ctx.db.rescueRequest.create({
        data: {
          message: input.message ?? "SOS Emergency - Immediate Help Needed",
          location: input.location,
          latitude: input.latitude,
          longitude: input.longitude,
          status: "PENDING",
          // userId is now optional in the schema
        },
      });

      // Try to assign a nearby volunteer
      let assignedVolunteer = null;
      let searchRadiusUsed = 0;

      for (const radius of SEARCH_RADII) {
        const nearbyVolunteers = await ctx.db.volunteerProfile.findMany({
          where: {
            available: true,
            latitude: { not: null },
            longitude: { not: null },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Filter volunteers within radius
        const volunteersInRange = nearbyVolunteers
          .map((volunteer) => {
            const distance = calculateDistance(
              input.latitude,
              input.longitude,
              volunteer.latitude!,
              volunteer.longitude!
            );
            return { ...volunteer, distance };
          })
          .filter((volunteer) => volunteer.distance <= radius)
          .sort((a, b) => a.distance - b.distance);

        if (volunteersInRange.length > 0) {
          // Assign the closest volunteer
          assignedVolunteer = volunteersInRange[0];
          searchRadiusUsed = radius;
          
          // Update rescue request with volunteer assignment
          await ctx.db.rescueRequest.update({
            where: { id: rescueRequest.id },
            data: {
              volunteerId: assignedVolunteer.user.id,
              status: "ASSIGNED",
              searchRadiusUsed: radius,
              assignedAt: new Date(),
            },
          });

          // Update volunteer availability
          await ctx.db.volunteerProfile.update({
            where: { userId: assignedVolunteer.user.id },
            data: { available: false },
          });

          // Calculate and update ETA
          try {
            const etaInputs: ETAInputs = {
              distance: assignedVolunteer.distance,
              volunteerLoad: 1, // Default load
              systemLoad: 1,    // Default load
              disasterType: "OTHER",
              timeOfDay: new Date().getHours(),
            };
            
            const eta = predictResponseTime(etaInputs);
            
            await ctx.db.rescueRequest.update({
              where: { id: rescueRequest.id },
              data: {
                etaMinMinutes: Math.floor(eta.estimatedMinutes),
                etaMaxMinutes: Math.ceil(eta.estimatedMinutes * 1.3),
                etaConfidence: eta.confidence,
                etaFactors: JSON.stringify(eta.factors),
              },
            });
          } catch (error) {
            console.error("Failed to calculate ETA:", error);
          }
          
          break;
        }
      }

      return {
        rescueRequest,
        assignedVolunteer,
        searchRadiusUsed,
        message: assignedVolunteer 
          ? "SOS sent successfully! Volunteer assigned." 
          : "SOS sent successfully! Searching for volunteers."
      };
    }),

  // Cancel a rescue request (USER only)
  cancel: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
      })
    )
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
          message: "You can only cancel your own rescue requests",
        });
      }

      // Update status to cancelled
      const cancelledRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: { status: "COMPLETED" },
      });

      // If there was an assigned volunteer, make them available again
      if (request.volunteerId) {
        await ctx.db.volunteerProfile.update({
          where: { userId: request.volunteerId },
          data: { available: true },
        });
      }

      return cancelledRequest;
    }),

  // Get all rescue requests (for authority dashboard)
  getAllRequests: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is AUTHORITY
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view all rescue requests",
      });
    }

    const allRequests = await ctx.db.rescueRequest.findMany({
      where: {
        status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS", "NO_VOLUNTEER"] },
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        volunteer: {
          select: {
            id: true,
            name: true,
            email: true,
            volunteerProfile: {
              select: {
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return allRequests;
  }),

  // Get escalated requests (NO_VOLUNTEER) for authority dashboard
  getEscalated: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is AUTHORITY
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view escalated requests",
      });
    }

    const escalatedRequests = await ctx.db.rescueRequest.findMany({
      where: {
        status: "NO_VOLUNTEER",
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        volunteer: {
          select: {
            id: true,
            name: true,
            email: true,
            volunteerProfile: {
              select: {
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
      orderBy: { escalatedAt: "asc" },
    });

    return escalatedRequests;
  }),

  // Get all rescue requests relevant to volunteer (unified query)
  getForVolunteer: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is VOLUNTEER
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can view volunteer requests",
      });
    }

    // Get assigned requests
    const assigned = await ctx.db.rescueRequest.findMany({
      where: {
        volunteerId: ctx.session.user.id,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    // Get pending requests
    const pending = await ctx.db.rescueRequest.findMany({
      where: {
        status: "PENDING",
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get escalated requests
    const escalated = await ctx.db.rescueRequest.findMany({
      where: {
        status: "NO_VOLUNTEER",
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { escalatedAt: "asc" },
    });

    return {
      assigned,
      pending,
      escalated,
      totalAlerts: assigned.length + pending.length + escalated.length,
    };
  }),

  // Get pending requests available for any volunteer
  getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is VOLUNTEER
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can view pending requests",
      });
    }

    const pendingRequests = await ctx.db.rescueRequest.findMany({
      where: {
        status: "PENDING",
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return pendingRequests;
  }),

  // Get requests assigned to current volunteer
  getMyAssignedRequests: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is VOLUNTEER
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can view their assigned requests",
      });
    }

    const assignedRequests = await ctx.db.rescueRequest.findMany({
      where: {
        volunteerId: ctx.session.user.id,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return assignedRequests;
  }),

  // Get current user's rescue requests
  getMyRequests: protectedProcedure.query(async ({ ctx }) => {
    const requests = await ctx.db.rescueRequest.findMany({
      where: { userId: ctx.session.user.id },
      select: {
        id: true,
        userId: true,
        volunteerId: true,
        status: true,
        message: true,
        location: true,
        latitude: true,
        longitude: true,
        disasterType: true,
        note: true,
        searchRadiusUsed: true,
        etaMinMinutes: true,
        etaMaxMinutes: true,
        etaConfidence: true,
        etaFactors: true,
        escalatedAt: true,
        assignedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        volunteer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests;
  }),

  // Accept a rescue request (VOLUNTEER only)
  acceptRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is VOLUNTEER
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can accept rescue requests",
        });
      }

      const request = await ctx.db.rescueRequest.findUnique({
        where: { id: input.requestId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
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
          message: "This request cannot be accepted",
        });
      }

      // Check if volunteer already has active assignments
      const activeAssignments = await ctx.db.rescueRequest.count({
        where: {
          volunteerId: ctx.session.user.id,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
      });

      if (activeAssignments >= 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have 3 active rescue assignments",
        });
      }

      // Update request status
      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: {
          volunteerId: ctx.session.user.id,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      });

      // Update volunteer availability
      await ctx.db.volunteerProfile.update({
        where: { userId: ctx.session.user.id },
        data: { available: activeAssignments >= 2 }, // Unavailable if 2+ assignments
      });

      // Calculate and update ETA
      if (request.latitude && request.longitude) {
        const volunteerProfile = await ctx.db.volunteerProfile.findUnique({
          where: { userId: ctx.session.user.id },
        });

        if (volunteerProfile?.latitude && volunteerProfile?.longitude) {
          try {
            const distance = calculateDistance(
              request.latitude,
              request.longitude,
              volunteerProfile.latitude,
              volunteerProfile.longitude
            );

            const etaInputs: ETAInputs = {
              distance,
              volunteerLoad: activeAssignments + 1,
              systemLoad: 1, // This would come from system metrics
              disasterType: request.disasterType ?? "OTHER",
              timeOfDay: new Date().getHours(),
            };
            
            const eta = predictResponseTime(etaInputs);
            
            await ctx.db.rescueRequest.update({
              where: { id: input.requestId },
              data: {
                etaMinMinutes: Math.floor(eta.estimatedMinutes),
                etaMaxMinutes: Math.ceil(eta.estimatedMinutes * 1.3),
                etaConfidence: eta.confidence,
                etaFactors: JSON.stringify(eta.factors),
              },
            });
          } catch (error) {
            console.error("Failed to calculate ETA:", error);
          }
        }
      }

      return updatedRequest;
    }),

  // Update request status (VOLUNTEER only)
  updateStatus: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        status: z.enum(["IN_PROGRESS", "COMPLETED"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is VOLUNTEER
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can update rescue request status",
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
          message: "You can only update requests assigned to you",
        });
      }

      const updateData: any = { status: input.status };
      if (input.note) updateData.note = input.note;
      if (input.status === "COMPLETED") updateData.completedAt = new Date();

      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: updateData,
      });

      // If completed, make volunteer available again
      if (input.status === "COMPLETED") {
        const activeAssignments = await ctx.db.rescueRequest.count({
          where: {
            volunteerId: ctx.session.user.id,
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          },
        });

        await ctx.db.volunteerProfile.update({
          where: { userId: ctx.session.user.id },
          data: { available: activeAssignments < 3 },
        });
      }

      return updatedRequest;
    }),

  // Manual assignment by authority
  manualAssign: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        volunteerId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is AUTHORITY
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can manually assign volunteers",
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

      const volunteer = await ctx.db.volunteerProfile.findUnique({
        where: { userId: input.volunteerId },
        include: { user: true },
      });

      if (!volunteer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Volunteer not found",
        });
      }

      if (!volunteer.available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Volunteer is not available",
        });
      }

      // Update request
      const updatedRequest = await ctx.db.rescueRequest.update({
        where: { id: input.requestId },
        data: {
          volunteerId: input.volunteerId,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      });

      // Update volunteer availability
      await ctx.db.volunteerProfile.update({
        where: { userId: input.volunteerId },
        data: { available: false },
      });

      return updatedRequest;
    }),
});