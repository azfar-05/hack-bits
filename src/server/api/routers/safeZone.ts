import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const safeZoneRouter = createTRPCRouter({
  // Create a new safe zone (VOLUNTEER or AUTHORITY only)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        type: z.enum(["SHELTER", "CAMP", "HOSPITAL"]),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        capacity: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "VOLUNTEER" && ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers and authorities can create safe zones",
        });
      }

      const safeZone = await ctx.db.safeZone.create({
        data: {
          name: input.name,
          type: input.type,
          latitude: input.latitude,
          longitude: input.longitude,
          capacity: input.capacity,
          createdBy: ctx.session.user.id,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      console.log(`[SAFE_ZONE] Created ${input.type}: ${input.name} by ${ctx.session.user.role} ${ctx.session.user.email}`);

      return safeZone;
    }),

  // Get all safe zones (for authority map)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view all safe zones",
      });
    }

    const safeZones = await ctx.db.safeZone.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return safeZones;
  }),

  // Get safe zones created by current user
  getMyZones: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "VOLUNTEER" && ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers and authorities can view their safe zones",
      });
    }

    const safeZones = await ctx.db.safeZone.findMany({
      where: { createdBy: ctx.session.user.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return safeZones;
  }),

  // Delete a safe zone (only creator can delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const safeZone = await ctx.db.safeZone.findUnique({
        where: { id: input.id },
      });

      if (!safeZone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Safe zone not found",
        });
      }

      if (safeZone.createdBy !== ctx.session.user.id && ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete safe zones you created",
        });
      }

      await ctx.db.safeZone.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // Get nearby safe zones (public access for emergency situations)
  getNearby: publicProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radiusKm: z.number().min(1).max(50).default(10), // Default 10km radius
      })
    )
    .query(async ({ ctx, input }) => {
      // Get all safe zones and calculate distance
      const safeZones = await ctx.db.safeZone.findMany({
        include: {
          creator: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Filter by distance (simple calculation for demo)
      const nearbySafeZones = safeZones.filter((zone) => {
        const distance = calculateDistance(
          input.latitude,
          input.longitude,
          zone.latitude,
          zone.longitude
        );
        return distance <= input.radiusKm;
      });

      return nearbySafeZones.map((zone) => ({
        ...zone,
        distance: calculateDistance(
          input.latitude,
          input.longitude,
          zone.latitude,
          zone.longitude
        ),
      })).sort((a, b) => a.distance - b.distance);
    }),

  // Get all safe zones for public viewing (for maps)
  getPublic: publicProcedure.query(async ({ ctx }) => {
    const safeZones = await ctx.db.safeZone.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        latitude: true,
        longitude: true,
        capacity: true,
        createdAt: true,
        creator: {
          select: { role: true }, // Only show creator role for verification
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return safeZones;
  }),
});

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}