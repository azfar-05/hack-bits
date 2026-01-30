import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const emergencyRouter = createTRPCRouter({
  // Create a new emergency request (SOS) for the current user
  create: protectedProcedure
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Load user's phone number from DB (optional for demo)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true, email: true },
      });

      const emergency = await ctx.db.emergencyRequest.create({
        data: {
          userId,
          phoneNumber: user?.phoneNumber ?? user?.email ?? "N/A",
          latitude: input.latitude,
          longitude: input.longitude,
          // status defaults to OPEN via Prisma schema
        },
      });

      console.log(`[EMERGENCY] SOS created by ${user?.email} at (${input.latitude}, ${input.longitude})`);

      return emergency;
    }),

  // Resolve the latest open emergency for the current user.
  // If none exists, create a lightweight SafetyConfirmation record instead.
  resolveLatest: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const latestOpen = await ctx.db.emergencyRequest.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });

    if (latestOpen) {
      const updated = await ctx.db.emergencyRequest.update({
        where: { id: latestOpen.id },
        data: { status: "RESOLVED" },
      });
      return { resolved: true, emergency: updated };
    }

    // No open emergency — create a SafetyConfirmation so authority dashboards can see the confirmation
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });

    const confirmation = await ctx.db.safetyConfirmation.create({
      data: {
        userId,
        phoneNumber: user?.phoneNumber ?? "",
      },
    });

    return { resolved: false, confirmation };
  }),
});
