import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const aiRouter = createTRPCRouter({
  // Generate risk assessment for a location
  generateRiskAssessment: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      disasterType: z.enum(["FLOOD", "EARTHQUAKE", "FIRE", "MEDICAL", "BUILDING_COLLAPSE", "OTHER"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Simulate AI/ML risk assessment
      // In a real implementation, this would call an ML model
      const riskFactors = await analyzeRiskFactors(ctx, input);
      const riskScore = calculateRiskScore(riskFactors);
      const recommendations = generateRecommendations(riskFactors, input.disasterType);

      // Store the assessment
      const assessment = await ctx.db.riskAssessment.create({
        data: {
          userId: ctx.session.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
          disasterType: input.disasterType,
          riskScore: riskScore.score,
          confidence: riskScore.confidence,
          factors: JSON.stringify(riskFactors),
          recommendations: JSON.stringify(recommendations),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 24 hours
        },
      });

      return {
        ...assessment,
        factors: riskFactors,
        recommendations,
      };
    }),

  // Get recent risk assessments for user
  getMyRiskAssessments: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const assessments = await ctx.db.riskAssessment.findMany({
        where: {
          userId: ctx.session.user.id,
          validUntil: { gt: new Date() },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });

      return assessments.map(assessment => ({
        ...assessment,
        factors: JSON.parse(assessment.factors),
        recommendations: JSON.parse(assessment.recommendations),
      }));
    }),

  // Predict volunteer response time
  predictResponseTime: protectedProcedure
    .input(z.object({
      userLatitude: z.number(),
      userLongitude: z.number(),
      disasterType: z.enum(["FLOOD", "EARTHQUAKE", "FIRE", "MEDICAL", "BUILDING_COLLAPSE", "OTHER"]),
    }))
    .query(async ({ ctx, input }) => {
      // Get nearby volunteers
      const volunteers = await ctx.db.$queryRaw<Array<{
        id: string;
        latitude: number | null;
        longitude: number | null;
        available: boolean;
        distance: number;
      }>>`
        SELECT 
          vp.user_id as id,
          vp.latitude,
          vp.longitude,
          vp.available,
          (
            6371 * acos(
              cos(radians(${input.userLatitude})) * 
              cos(radians(vp.latitude)) * 
              cos(radians(vp.longitude) - radians(${input.userLongitude})) + 
              sin(radians(${input.userLatitude})) * 
              sin(radians(vp.latitude))
            )
          ) as distance
        FROM "VolunteerProfile" vp
        WHERE 
          vp.latitude IS NOT NULL 
          AND vp.longitude IS NOT NULL
          AND vp.available = true
        HAVING distance <= 10
        ORDER BY distance ASC
        LIMIT 10
      `;

      // Get current system load
      const activeRequests = await ctx.db.rescueRequest.count({
        where: {
          status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
        },
      });

      // Simulate ML prediction
      const prediction = predictETA({
        volunteers,
        activeRequests,
        disasterType: input.disasterType,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      });

      return prediction;
    }),

  // Get disaster prediction for area
  getDisasterPrediction: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      // Get historical data for the area
      const historicalAlerts = await ctx.db.alert.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }, // Last year
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      // Simulate disaster prediction based on historical patterns
      const predictions = analyzeDisasterPatterns(historicalAlerts, input);

      return predictions;
    }),

  // Optimize resource allocation
  optimizeResourceAllocation: protectedProcedure
    .input(z.object({
      emergencyLatitude: z.number(),
      emergencyLongitude: z.number(),
      requiredResources: z.array(z.enum(["BOAT", "GENERATOR", "WATER", "FOOD", "MEDICAL", "OTHER"])),
    }))
    .query(async ({ ctx, input }) => {
      // Get available resources nearby
      const resources = await ctx.db.$queryRaw<Array<{
        id: string;
        name: string;
        resourceType: string;
        quantity: number;
        latitude: number;
        longitude: number;
        contactInfo: string | null;
        distance: number;
      }>>`
        SELECT *,
          (
            6371 * acos(
              cos(radians(${input.emergencyLatitude})) * 
              cos(radians(latitude)) * 
              cos(radians(longitude) - radians(${input.emergencyLongitude})) + 
              sin(radians(${input.emergencyLatitude})) * 
              sin(radians(latitude))
            )
          ) as distance
        FROM "ResourceNode"
        WHERE resource_type = ANY(${input.requiredResources})
        HAVING distance <= 20
        ORDER BY distance ASC
        LIMIT 20
      `;

      // Optimize allocation using simple greedy algorithm
      const allocation = optimizeAllocation(resources, input.requiredResources);

      return allocation;
    }),
});

// Helper functions for AI/ML simulation

async function analyzeRiskFactors(ctx: any, input: { latitude: number; longitude: number; disasterType: string }) {
  // Simulate risk factor analysis
  const factors = [];

  // Check nearby danger zones
  const dangerZones = await ctx.db.dangerZone.count({
    where: {
      isActive: true,
      // Simplified distance check
    },
  });

  if (dangerZones > 0) {
    factors.push("Active danger zones nearby");
  }

  // Check historical incidents
  const recentAlerts = await ctx.db.alert.count({
    where: {
      disasterType: input.disasterType,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  if (recentAlerts > 0) {
    factors.push(`${recentAlerts} recent ${input.disasterType.toLowerCase()} alerts`);
  }

  // Add time-based factors
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 6) {
    factors.push("Night time - reduced visibility");
  }

  // Add weather simulation (in real app, integrate with weather API)
  const weatherRisk = Math.random();
  if (weatherRisk > 0.7) {
    factors.push("Adverse weather conditions");
  }

  return factors;
}

function calculateRiskScore(factors: string[]): { score: number; confidence: number } {
  const baseRisk = 0.3;
  const factorWeight = 0.15;
  const score = Math.min(1.0, baseRisk + (factors.length * factorWeight));
  const confidence = Math.max(0.6, 1.0 - (factors.length * 0.05));

  return { score, confidence };
}

function generateRecommendations(factors: string[], disasterType: string): string[] {
  const recommendations = [];

  if (factors.some(f => f.includes("danger zones"))) {
    recommendations.push("Avoid marked danger zones");
  }

  if (factors.some(f => f.includes("night time"))) {
    recommendations.push("Use flashlight and reflective gear");
  }

  if (factors.some(f => f.includes("weather"))) {
    recommendations.push("Monitor weather conditions closely");
  }

  // Disaster-specific recommendations
  switch (disasterType) {
    case "FLOOD":
      recommendations.push("Stay on higher ground", "Avoid walking through flowing water");
      break;
    case "EARTHQUAKE":
      recommendations.push("Stay away from buildings", "Have emergency kit ready");
      break;
    case "FIRE":
      recommendations.push("Keep evacuation routes clear", "Have fire extinguisher accessible");
      break;
  }

  return recommendations;
}

function predictETA(params: {
  volunteers: Array<{ distance: number; available: boolean }>;
  activeRequests: number;
  disasterType: string;
  timeOfDay: number;
  dayOfWeek: number;
}): {
  minMinutes: number;
  maxMinutes: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  factors: string[];
} {
  const { volunteers, activeRequests, disasterType, timeOfDay, dayOfWeek } = params;

  let baseTime = 15; // Base response time in minutes
  const factors = [];

  // Distance factor
  if (volunteers.length > 0) {
    const nearestDistance = Math.min(...volunteers.map(v => v.distance));
    baseTime += nearestDistance * 2; // 2 minutes per km
    factors.push(`Nearest volunteer: ${nearestDistance.toFixed(1)}km away`);
  } else {
    baseTime += 30;
    factors.push("No volunteers nearby");
  }

  // System load factor
  if (activeRequests > 10) {
    baseTime += 10;
    factors.push("High system load");
  }

  // Time of day factor
  if (timeOfDay >= 22 || timeOfDay <= 6) {
    baseTime += 5;
    factors.push("Night time response");
  }

  // Disaster type factor
  if (disasterType === "MEDICAL") {
    baseTime -= 5; // Medical emergencies get priority
    factors.push("Medical emergency priority");
  }

  const minMinutes = Math.max(5, Math.round(baseTime * 0.8));
  const maxMinutes = Math.round(baseTime * 1.3);
  
  const confidence = volunteers.length > 2 && activeRequests < 5 ? "HIGH" : 
                    volunteers.length > 0 && activeRequests < 10 ? "MEDIUM" : "LOW";

  return { minMinutes, maxMinutes, confidence, factors };
}

function analyzeDisasterPatterns(historicalAlerts: any[], location: { latitude: number; longitude: number; radiusKm: number }) {
  // Simulate pattern analysis
  const patterns = {
    flood: { probability: 0.15, season: "monsoon", trend: "increasing" },
    earthquake: { probability: 0.05, season: "any", trend: "stable" },
    fire: { probability: 0.25, season: "summer", trend: "increasing" },
  };

  return {
    predictions: [
      {
        disasterType: "FIRE",
        probability: patterns.fire.probability,
        timeframe: "next 30 days",
        confidence: 0.75,
        factors: ["Dry season approaching", "Historical fire incidents in area"],
      },
      {
        disasterType: "FLOOD",
        probability: patterns.flood.probability,
        timeframe: "next 90 days",
        confidence: 0.65,
        factors: ["Monsoon season", "Low-lying area"],
      },
    ],
    overallRisk: "MEDIUM",
    lastUpdated: new Date(),
  };
}

function optimizeAllocation(resources: any[], requiredTypes: string[]) {
  const allocation = [];
  
  for (const type of requiredTypes) {
    const availableResources = resources
      .filter(r => r.resourceType === type)
      .sort((a, b) => a.distance - b.distance);

    if (availableResources.length > 0) {
      allocation.push({
        resourceType: type,
        recommended: availableResources[0],
        alternatives: availableResources.slice(1, 3),
        estimatedDeliveryTime: Math.round(availableResources[0].distance * 3), // 3 minutes per km
      });
    }
  }

  return {
    allocation,
    totalEstimatedTime: Math.max(...allocation.map(a => a.estimatedDeliveryTime)),
    efficiency: allocation.length / requiredTypes.length,
  };
}