import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const volunteerRouter = createTRPCRouter({
  // Update volunteer's live location
  updateLocation: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can update location",
        });
      }

      // Upsert volunteer profile with new location
      const profile = await ctx.db.volunteerProfile.upsert({
        where: { userId: ctx.session.user.id },
        update: {
          latitude: input.latitude,
          longitude: input.longitude,
          updatedAt: new Date(),
        },
        create: {
          userId: ctx.session.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
          available: true,
        },
      });

      console.log(`[VOLUNTEER] Location updated: ${ctx.session.user.id} -> (${input.latitude}, ${input.longitude})`);

      return profile;
    }),

  // Get volunteer's own profile
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "VOLUNTEER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only volunteers can access this",
      });
    }

    const profile = await ctx.db.volunteerProfile.findUnique({
      where: { userId: ctx.session.user.id },
    });

    return profile;
  }),

  // Update availability status
  setAvailability: protectedProcedure
    .input(z.object({ available: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "VOLUNTEER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only volunteers can update availability",
        });
      }

      const profile = await ctx.db.volunteerProfile.upsert({
        where: { userId: ctx.session.user.id },
        update: { available: input.available },
        create: {
          userId: ctx.session.user.id,
          available: input.available,
        },
      });

      return profile;
    }),

  // Get all volunteers with their locations (for AUTHORITY)
  getAllWithLocations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view all volunteers",
      });
    }

    const volunteers = await ctx.db.user.findMany({
      where: { role: "VOLUNTEER" },
      include: {
        volunteerProfile: true,
        volunteerAssignments: {
          where: {
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          },
        },
      },
    });

    return volunteers.map((v) => ({
      id: v.id,
      name: v.name,
      email: v.email,
      latitude: v.volunteerProfile?.latitude,
      longitude: v.volunteerProfile?.longitude,
      available: v.volunteerProfile?.available ?? false,
      lastUpdated: v.volunteerProfile?.updatedAt,
      activeAssignments: v.volunteerAssignments.length,
    }));
  }),
});
