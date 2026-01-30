import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const trainingRouter = createTRPCRouter({
  // Get all training modules
  getModules: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
      isRequired: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.trainingModule.findMany({
        where: {
          category: input.category,
          difficulty: input.difficulty,
          isRequired: input.isRequired,
        },
        orderBy: [
          { isRequired: "desc" },
          { difficulty: "asc" },
          { createdAt: "desc" },
        ],
      });
    }),

  // Get a specific training module
  getModule: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const module = await ctx.db.trainingModule.findUnique({
        where: { id: input.id },
      });

      if (!module) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training module not found",
        });
      }

      return module;
    }),

  // Get user's training progress
  getMyProgress: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.trainingProgress.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        include: {
          module: true,
        },
        orderBy: {
          startedAt: "desc",
        },
      });
    }),

  // Start a training module
  startModule: protectedProcedure
    .input(z.object({
      moduleId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if module exists
      const module = await ctx.db.trainingModule.findUnique({
        where: { id: input.moduleId },
      });

      if (!module) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training module not found",
        });
      }

      // Check if user already has progress for this module
      const existingProgress = await ctx.db.trainingProgress.findUnique({
        where: {
          userId_moduleId: {
            userId: ctx.session.user.id,
            moduleId: input.moduleId,
          },
        },
      });

      if (existingProgress) {
        // If already started, just return existing progress
        if (existingProgress.status !== "NOT_STARTED") {
          return existingProgress;
        }
        
        // Update to started
        return ctx.db.trainingProgress.update({
          where: { id: existingProgress.id },
          data: {
            status: "IN_PROGRESS",
            startedAt: new Date(),
          },
          include: {
            module: true,
          },
        });
      }

      // Create new progress record
      return ctx.db.trainingProgress.create({
        data: {
          userId: ctx.session.user.id,
          moduleId: input.moduleId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
        include: {
          module: true,
        },
      });
    }),

  // Update training progress
  updateProgress: protectedProcedure
    .input(z.object({
      moduleId: z.string(),
      progress: z.number().min(0).max(100),
      score: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existingProgress = await ctx.db.trainingProgress.findUnique({
        where: {
          userId_moduleId: {
            userId: ctx.session.user.id,
            moduleId: input.moduleId,
          },
        },
      });

      if (!existingProgress) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training progress not found. Start the module first.",
        });
      }

      const isCompleted = input.progress >= 100;
      const completedAt = isCompleted ? new Date() : null;
      
      // Calculate expiration date (1 year from completion for certifications)
      const expiresAt = isCompleted ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;

      return ctx.db.trainingProgress.update({
        where: { id: existingProgress.id },
        data: {
          progress: input.progress,
          score: input.score,
          status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
          completedAt,
          expiresAt,
        },
        include: {
          module: true,
        },
      });
    }),

  // Get training statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const [totalModules, completedModules, inProgressModules, requiredCompleted] = await Promise.all([
        ctx.db.trainingModule.count(),
        ctx.db.trainingProgress.count({
          where: {
            userId,
            status: "COMPLETED",
          },
        }),
        ctx.db.trainingProgress.count({
          where: {
            userId,
            status: "IN_PROGRESS",
          },
        }),
        ctx.db.trainingProgress.count({
          where: {
            userId,
            status: "COMPLETED",
            module: {
              isRequired: true,
            },
          },
        }),
      ]);

      const totalRequired = await ctx.db.trainingModule.count({
        where: { isRequired: true },
      });

      return {
        totalModules,
        completedModules,
        inProgressModules,
        requiredCompleted,
        totalRequired,
        completionRate: totalModules > 0 ? (completedModules / totalModules) * 100 : 0,
        requiredCompletionRate: totalRequired > 0 ? (requiredCompleted / totalRequired) * 100 : 0,
      };
    }),

  // Get leaderboard (gamification)
  getLeaderboard: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      category: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const leaderboard = await ctx.db.$queryRaw<Array<{
        userId: string;
        userName: string | null;
        userEmail: string | null;
        userRole: string;
        completedModules: number;
        averageScore: number;
        totalPoints: number;
      }>>`
        SELECT 
          u.id as "userId",
          u.name as "userName",
          u.email as "userEmail",
          u.role as "userRole",
          COUNT(tp.id)::int as "completedModules",
          COALESCE(AVG(tp.score), 0)::int as "averageScore",
          (COUNT(tp.id) * 10 + COALESCE(AVG(tp.score), 0))::int as "totalPoints"
        FROM "User" u
        LEFT JOIN "TrainingProgress" tp ON tp.user_id = u.id AND tp.status = 'COMPLETED'
        ${input.category ? `LEFT JOIN "TrainingModule" tm ON tm.id = tp.module_id AND tm.category = '${input.category}'` : ''}
        GROUP BY u.id, u.name, u.email, u.role
        HAVING COUNT(tp.id) > 0
        ORDER BY "totalPoints" DESC, "completedModules" DESC, "averageScore" DESC
        LIMIT ${input.limit}
      `;

      return leaderboard;
    }),

  // Create training module (admin only)
  createModule: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(1000),
      content: z.string().min(1),
      difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
      duration: z.number().min(1).max(480), // Max 8 hours
      category: z.string().min(1).max(100),
      isRequired: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only authorities can create training modules
      if (ctx.session.user.role !== "AUTHORITY") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only authorities can create training modules",
        });
      }

      return ctx.db.trainingModule.create({
        data: input,
      });
    }),

  // Get categories
  getCategories: publicProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.db.trainingModule.findMany({
        select: {
          category: true,
        },
        distinct: ["category"],
        orderBy: {
          category: "asc",
        },
      });

      return categories.map(c => c.category);
    }),
});