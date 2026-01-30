import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const mappingRouter = createTRPCRouter({
  // Get Points of Interest near a location
  getNearbyPOIs: publicProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().min(0.1).max(50).default(10),
      category: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pois = await ctx.db.$queryRaw<Array<{
        id: string;
        name: string;
        category: string;
        latitude: number;
        longitude: number;
        address: string | null;
        phoneNumber: string | null;
        capacity: number | null;
        isActive: boolean;
        metadata: string | null;
        distance: number;
      }>>`
        SELECT *,
          (
            6371 * acos(
              cos(radians(${input.latitude})) * 
              cos(radians(latitude)) * 
              cos(radians(longitude) - radians(${input.longitude})) + 
              sin(radians(${input.latitude})) * 
              sin(radians(latitude))
            )
          ) as distance
        FROM "PointOfInterest"
        WHERE 
          is_active = true
          ${input.category ? `AND category = '${input.category}'` : ''}
        HAVING distance <= ${input.radiusKm}
        ORDER BY distance ASC
        LIMIT 50
      `;

      return pois;
    }),

  // Create Point of Interest (authorities only)
  createPOI: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      category: z.string().min(1).max(50),
      latitude: z.number(),
      longitude: z.number(),
      address: z.string().max(500).optional(),
      phoneNumber: z.string().max(20).optional(),
      capacity: z.number().min(1).optional(),
      metadata: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can create Points of Interest",
        });
      }

      return ctx.db.pointOfInterest.create({
        data: input,
      });
    }),

  // Get active danger zones
  getDangerZones: publicProcedure
    .input(z.object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      radiusKm: z.number().min(0.1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      
      if (input.latitude && input.longitude) {
        // Get danger zones near a specific location
        const zones = await ctx.db.$queryRaw<Array<{
          id: string;
          name: string;
          description: string | null;
          latitude: number;
          longitude: number;
          radiusKm: number;
          riskLevel: string;
          isActive: boolean;
          validUntil: Date | null;
          distance: number;
        }>>`
          SELECT *,
            (
              6371 * acos(
                cos(radians(${input.latitude})) * 
                cos(radians(latitude)) * 
                cos(radians(longitude) - radians(${input.longitude})) + 
                sin(radians(${input.latitude})) * 
                sin(radians(latitude))
              )
            ) as distance
          FROM "DangerZone"
          WHERE 
            is_active = true
            AND (valid_until IS NULL OR valid_until > ${now})
          HAVING distance <= ${input.radiusKm}
          ORDER BY distance ASC
        `;

        return zones;
      } else {
        // Get all active danger zones
        return ctx.db.dangerZone.findMany({
          where: {
            isActive: true,
            OR: [
              { validUntil: null },
              { validUntil: { gt: now } },
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      }
    }),

  // Create danger zone (authorities only)
  createDangerZone: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().min(0.1).max(50),
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
      validUntil: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can create danger zones",
        });
      }

      return ctx.db.dangerZone.create({
        data: input,
      });
    }),

  // Get optimal route avoiding danger zones
  getOptimalRoute: protectedProcedure
    .input(z.object({
      startLat: z.number(),
      startLng: z.number(),
      endLat: z.number(),
      endLng: z.number(),
      avoidDangerZones: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      // Get danger zones along the route
      const dangerZones = input.avoidDangerZones ? await ctx.db.dangerZone.findMany({
        where: {
          isActive: true,
          OR: [
            { validUntil: null },
            { validUntil: { gt: new Date() } },
          ],
        },
      }) : [];

      // Simple route calculation (in a real app, you'd use a routing service)
      const directDistance = calculateDistance(
        input.startLat, input.startLng,
        input.endLat, input.endLng
      );

      // Check if direct route intersects with any danger zones
      const routeIntersectsDanger = dangerZones.some(zone => {
        const distanceToZone = calculateDistance(
          (input.startLat + input.endLat) / 2,
          (input.startLng + input.endLng) / 2,
          zone.latitude,
          zone.longitude
        );
        return distanceToZone <= zone.radiusKm;
      });

      return {
        distance: directDistance,
        estimatedTime: Math.round(directDistance * 2), // Rough estimate: 2 minutes per km
        dangerZonesOnRoute: routeIntersectsDanger ? dangerZones.length : 0,
        waypoints: [
          { lat: input.startLat, lng: input.startLng },
          { lat: input.endLat, lng: input.endLng },
        ],
        warnings: routeIntersectsDanger ? ["Route passes through danger zones"] : [],
      };
    }),

  // Get POI categories
  getPOICategories: publicProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.db.pointOfInterest.findMany({
        select: {
          category: true,
        },
        distinct: ["category"],
        where: {
          isActive: true,
        },
        orderBy: {
          category: "asc",
        },
      });

      return categories.map(c => c.category);
    }),

  // Update POI (authorities only)
  updatePOI: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      category: z.string().min(1).max(50).optional(),
      address: z.string().max(500).optional(),
      phoneNumber: z.string().max(20).optional(),
      capacity: z.number().min(1).optional(),
      isActive: z.boolean().optional(),
      metadata: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can update Points of Interest",
        });
      }

      const { id, ...updateData } = input;

      return ctx.db.pointOfInterest.update({
        where: { id },
        data: updateData,
      });
    }),

  // Deactivate danger zone
  deactivateDangerZone: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can deactivate danger zones",
        });
      }

      return ctx.db.dangerZone.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),
});

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}