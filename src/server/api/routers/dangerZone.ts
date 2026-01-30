import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Grid precision for zone calculation (0.01 = ~1km resolution)
const ZONE_PRECISION = 0.01;

// Time window for recent SOS activity (15 minutes)
const RECENT_SOS_WINDOW_MS = 15 * 60 * 1000;

interface DangerZone {
  zoneLat: number;
  zoneLng: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  sosCount: number;
  unknownUsers: number;
  growthRate: number;
}

export const dangerZoneRouter = createTRPCRouter({
  // Get all danger zones with risk assessment (AUTHORITY only)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role !== "AUTHORITY") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only authorities can view danger zones",
      });
    }

    const now = new Date();
    const recentTime = new Date(now.getTime() - RECENT_SOS_WINDOW_MS);
    const olderTime = new Date(now.getTime() - (RECENT_SOS_WINDOW_MS * 2));

    // Get recent rescue requests with location data
    const recentRequests = await ctx.db.rescueRequest.findMany({
      where: {
        createdAt: { gte: recentTime },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
      },
    });

    // Get older requests for growth rate calculation
    const olderRequests = await ctx.db.rescueRequest.findMany({
      where: {
        createdAt: { gte: olderTime, lt: recentTime },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
      },
    });

    // Group requests by zone
    const zoneMap = new Map<string, {
      zoneLat: number;
      zoneLng: number;
      recentSos: number;
      olderSos: number;
      unknownUsers: number;
    }>();

    // Process recent requests
    recentRequests.forEach(req => {
      if (!req.latitude || !req.longitude) return;
      
      const zoneLat = Math.floor(req.latitude / ZONE_PRECISION) * ZONE_PRECISION;
      const zoneLng = Math.floor(req.longitude / ZONE_PRECISION) * ZONE_PRECISION;
      const zoneKey = `${zoneLat},${zoneLng}`;

      if (!zoneMap.has(zoneKey)) {
        zoneMap.set(zoneKey, {
          zoneLat,
          zoneLng,
          recentSos: 0,
          olderSos: 0,
          unknownUsers: 0,
        });
      }

      const zone = zoneMap.get(zoneKey)!;
      zone.recentSos++;

      // Count users with unknown status (pending, no volunteer, etc.)
      if (req.status === "PENDING" || req.status === "NO_VOLUNTEER") {
        zone.unknownUsers++;
      }
    });

    // Process older requests for growth rate
    olderRequests.forEach(req => {
      if (!req.latitude || !req.longitude) return;
      
      const zoneLat = Math.floor(req.latitude / ZONE_PRECISION) * ZONE_PRECISION;
      const zoneLng = Math.floor(req.longitude / ZONE_PRECISION) * ZONE_PRECISION;
      const zoneKey = `${zoneLat},${zoneLng}`;

      if (!zoneMap.has(zoneKey)) {
        zoneMap.set(zoneKey, {
          zoneLat,
          zoneLng,
          recentSos: 0,
          olderSos: 0,
          unknownUsers: 0,
        });
      }

      const zone = zoneMap.get(zoneKey)!;
      zone.olderSos++;
    });

    // Calculate risk scores and classify zones
    const dangerZones: DangerZone[] = Array.from(zoneMap.values()).map(zone => {
      const growthRate = zone.recentSos - zone.olderSos;
      
      // Risk scoring formula:
      // riskScore = (SOS_count_last_15_min * 3) + (UNKNOWN_users * 4) + (SOS_growth_rate * 5)
      const score = (zone.recentSos * 3) + (zone.unknownUsers * 4) + (growthRate * 5);

      let riskLevel: "LOW" | "MEDIUM" | "HIGH";
      if (score > 25) {
        riskLevel = "HIGH";
      } else if (score > 12) {
        riskLevel = "MEDIUM";
      } else {
        riskLevel = "LOW";
      }

      return {
        zoneLat: zone.zoneLat,
        zoneLng: zone.zoneLng,
        riskLevel,
        score,
        sosCount: zone.recentSos,
        unknownUsers: zone.unknownUsers,
        growthRate,
      };
    });

    // Filter out low-risk zones with zero activity to reduce noise
    const filteredZones = dangerZones.filter(zone => 
      zone.riskLevel !== "LOW" || zone.score > 0
    );

    console.log(`[DANGER_ZONES] Calculated ${filteredZones.length} zones (${filteredZones.filter(z => z.riskLevel === "HIGH").length} HIGH, ${filteredZones.filter(z => z.riskLevel === "MEDIUM").length} MEDIUM)`);

    return filteredZones;
  }),
});