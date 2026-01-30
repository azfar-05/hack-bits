import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const alertRouter = createTRPCRouter({
  // Create a new alert (AUTHORITY only)
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        message: z.string().min(1, "Message is required"),
        disasterType: z.enum(["FLOOD", "EARTHQUAKE", "FIRE"]),
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
});
