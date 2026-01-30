import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const guideRouter = createTRPCRouter({
  // Create or update a safety guide (AUTHORITY only)
  create: protectedProcedure
    .input(
      z.object({
        disasterType: z.enum(["FLOOD", "EARTHQUAKE", "FIRE"]),
        content: z.string().min(1, "Content is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is AUTHORITY
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can create safety guides",
        });
      }

      // Upsert - create or update guide for this disaster type
      const guide = await ctx.db.safetyGuide.upsert({
        where: { disasterType: input.disasterType },
        update: {
          content: input.content,
          updatedAt: new Date(),
        },
        create: {
          disasterType: input.disasterType,
          content: input.content,
        },
      });

      return guide;
    }),

  // Get guide by disaster type (USER only, but we allow all authenticated users)
  getByDisaster: protectedProcedure
    .input(
      z.object({
        disasterType: z.enum(["FLOOD", "EARTHQUAKE", "FIRE"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const guide = await ctx.db.safetyGuide.findUnique({
        where: { disasterType: input.disasterType },
      });

      return guide;
    }),

  // Get all guides (for caching purposes)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const guides = await ctx.db.safetyGuide.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return guides;
  }),
});
