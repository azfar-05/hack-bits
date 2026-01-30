import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Haversine formula to calculate distance between two points
 * @returns distance in kilometers
 */
function calculateDistance(
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

export const resourceNodeRouter = createTRPCRouter({
  // Create a new resource node (VOLUNTEER, BUSINESS, or AUTHORITY)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Resource name is required"),
        resourceType: z.enum(["BOAT", "GENERATOR", "WATER", "FOOD", "MEDICAL", "OTHER"]),
        quantity: z.number().int().positive("Quantity must be positive"),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        contactInfo: z.string().optional(),
        createdBy: z.enum(["VOLUNTEER", "BUSINESS", "AUTHORITY"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Determine creator type based on user role or input
      let creatorType = input.createdBy;
      if (!creatorType) {
        creatorType = ctx.session.user.role === "AUTHORITY" ? "AUTHORITY" : "VOLUNTEER";
      }

      const resourceNode = await ctx.db.resourceNode.create({
        data: {
          name: input.name,
          resourceType: input.resourceType,
          quantity: input.quantity,
          latitude: input.latitude,
          longitude: input.longitude,
          contactInfo: input.contactInfo,
          createdBy: creatorType,
          userId: ctx.session.user.id,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      console.log(`[RESOURCE] Created ${input.resourceType}: ${input.name} by ${creatorType} ${ctx.session.user.email}`);

      return resourceNode;
    }),

  // Get all resource nodes (for authority view)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view all resource nodes",
      });
    }

    const resourceNodes = await ctx.db.resourceNode.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return resourceNodes;
  }),

  // Get resource nodes created by current user
  getMyResources: protectedProcedure.query(async ({ ctx }) => {
    const resourceNodes = await ctx.db.resourceNode.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return resourceNodes;
  }),

  // Get nearby resource nodes for volunteers (smart suggestions)
  getNearby: protectedProcedure
    .input(
      z.object({
        volunteerLat: z.number().min(-90).max(90),
        volunteerLng: z.number().min(-180).max(180),
        maxDistance: z.number().positive().optional().default(5), // km
        limit: z.number().int().positive().optional().default(3),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can get nearby resources",
        });
      }

      // Get all resource nodes
      const allResources = await ctx.db.resourceNode.findMany({
        include: {
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      // Calculate distances and filter by max distance
      const nearbyResources = allResources
        .map((resource) => ({
          ...resource,
          distance: calculateDistance(
            input.volunteerLat,
            input.volunteerLng,
            resource.latitude,
            resource.longitude
          ),
        }))
        .filter((resource) => resource.distance <= input.maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, input.limit);

      console.log(`[RESOURCE] Found ${nearbyResources.length} nearby resources for volunteer ${ctx.session.user.email}`);

      return nearbyResources;
    }),

  // Update a resource node (only creator can update)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        quantity: z.number().int().positive().optional(),
        contactInfo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resourceNode = await ctx.db.resourceNode.findUnique({
        where: { id: input.id },
      });

      if (!resourceNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource node not found",
        });
      }

      if (resourceNode.userId !== ctx.session.user.id && ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update resources you created",
        });
      }

      const updatedResource = await ctx.db.resourceNode.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.quantity && { quantity: input.quantity }),
          ...(input.contactInfo !== undefined && { contactInfo: input.contactInfo }),
          updatedAt: new Date(),
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      return updatedResource;
    }),

  // Delete a resource node (only creator can delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resourceNode = await ctx.db.resourceNode.findUnique({
        where: { id: input.id },
      });

      if (!resourceNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource node not found",
        });
      }

      if (resourceNode.userId !== ctx.session.user.id && ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete resources you created",
        });
      }

      await ctx.db.resourceNode.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});