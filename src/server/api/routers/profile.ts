import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
  // Get current user's profile completion status
  getProfileStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        latitude: true,
        longitude: true,
        address: true,
        profileCompleted: true,
        role: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      ...user,
      needsProfileCompletion: !user.profileCompleted,
    };
  }),

  // Complete user profile with required details
  completeProfile: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        address: z.string().min(5, "Address must be at least 5 characters"),
        name: z.string().min(2, "Name must be at least 2 characters").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updatedUser = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          phoneNumber: input.phoneNumber,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address,
          profileCompleted: true,
          ...(input.name && { name: input.name }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          latitude: true,
          longitude: true,
          address: true,
          profileCompleted: true,
          role: true,
        },
      });

      return updatedUser;
    }),

  // Update profile (for existing users)
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters").optional(),
        phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        address: z.string().min(5, "Address must be at least 5 characters").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updatedUser = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          ...input,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          latitude: true,
          longitude: true,
          address: true,
          profileCompleted: true,
          role: true,
        },
      });

      return updatedUser;
    }),
});