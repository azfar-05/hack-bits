import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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

export const userRouter = createTRPCRouter({
  // Get users in a specific area (for authority disaster management)
  getUsersInArea: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radiusKm: z.number().int().min(1).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      // Only authorities can access this
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can access user location data",
        });
      }

      // Get all users with location data
      const users = await ctx.db.user.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          latitude: true,
          longitude: true,
          address: true,
          role: true,
          profileCompleted: true,
        },
      });

      // Filter users within the specified radius
      const usersInArea = users
        .map((user) => {
          const distance = calculateDistance(
            input.latitude,
            input.longitude,
            user.latitude!,
            user.longitude!
          );
          
          return {
            ...user,
            distance,
            isInAffectedZone: distance <= input.radiusKm,
          };
        })
        .filter((user) => user.isInAffectedZone)
        .sort((a, b) => a.distance - b.distance);

      return usersInArea;
    }),
});