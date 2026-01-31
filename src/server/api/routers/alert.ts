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

export const alertRouter = createTRPCRouter({
  // Create a new alert (AUTHORITY only)
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        message: z.string().min(1, "Message is required"),
        disasterType: z.enum(["FLOOD", "EARTHQUAKE", "FIRE"]),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radiusKm: z.number().int().min(5).max(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is AUTHORITY
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can create alerts",
        });
      }

      const alert = await ctx.db.alert.create({
        data: {
          title: input.title,
          message: input.message,
          disasterType: input.disasterType,
          latitude: input.latitude,
          longitude: input.longitude,
          radiusKm: input.radiusKm,
        },
      });

      return alert;
    }),

  // Get all alerts (USER only, but we allow all authenticated users to view)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const alerts = await ctx.db.alert.findMany({
      orderBy: { createdAt: "desc" },
    });

    return alerts;
  }),

  // Get alerts relevant to a user based on their location (only nearby alerts)
  getAlertsForUser: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
    )
    .query(async ({ ctx, input }) => {
      const alerts = await ctx.db.alert.findMany({
        orderBy: { createdAt: "desc" },
      });

      // Filter alerts to only show those near the user's location
      // User sees alerts where they are within the affected radius
      const nearbyAlerts = alerts
        .map((alert) => {
          const distance = calculateDistance(
            input.latitude,
            input.longitude,
            alert.latitude,
            alert.longitude
          );
          const isInAffectedZone = distance <= alert.radiusKm;

          return {
            ...alert,
            distance,
            isInAffectedZone,
          };
        })
        .filter((alert) => alert.isInAffectedZone); // Only return alerts affecting the user

      return nearbyAlerts;
    }),
});
