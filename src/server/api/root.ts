import { alertRouter } from "~/server/api/routers/alert";
import { guideRouter } from "~/server/api/routers/guide";
import { emergencyRouter } from "~/server/api/routers/emergency";
import { rescueRouter } from "~/server/api/routers/rescue";
import { volunteerRouter } from "~/server/api/routers/volunteer";
import { profileRouter } from "~/server/api/routers/profile";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  alert: alertRouter,
  guide: guideRouter,
  emergency: emergencyRouter,
  rescue: rescueRouter,
  volunteer: volunteerRouter,
  profile: profileRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.alert.getAll();
 */
export const createCaller = createCallerFactory(appRouter);
