import { PrismaClient } from "~/generated/prisma";

const prisma = new PrismaClient();

async function seedCommunityData() {
  try {
    console.log("🌱 Seeding community data...");

    // Get the first user to be the owner
    const firstUser = await prisma.user.findFirst();
    
    if (!firstUser) {
      console.log("❌ No users found. Please create a user first.");
      return;
    }

    console.log(`👤 Using user: ${firstUser.name || firstUser.email} as group owner`);

    // Create sample community groups
    const groups = await Promise.all([
      prisma.communityGroup.create({
        data: {
          name: "Downtown Emergency Response Team",
          description: "Community volunteers for downtown area emergency response and disaster preparedness.",
          type: "DISASTER_RESPONSE",
          latitude: 15.3173,
          longitude: 75.7139,
          radiusKm: 5,
          ownerId: firstUser.id,
          isPublic: true,
          maxMembers: 50,
        },
      }),
      
      prisma.communityGroup.create({
        data: {
          name: "Neighborhood Watch - Sector 7",
          description: "Local neighborhood watch group for Sector 7. We focus on community safety and emergency preparedness.",
          type: "NEIGHBORHOOD",
          latitude: 15.3200,
          longitude: 75.7200,
          radiusKm: 2,
          ownerId: firstUser.id,
          isPublic: true,
          maxMembers: 25,
        },
      }),

      prisma.communityGroup.create({
        data: {
          name: "First Aid Training Group",
          description: "Learn and practice first aid skills together. Regular training sessions and skill sharing.",
          type: "TRAINING",
          ownerId: firstUser.id,
          isPublic: true,
          maxMembers: 30,
        },
      }),

      prisma.communityGroup.create({
        data: {
          name: "General Community Support",
          description: "General community group for mutual support, information sharing, and coordination.",
          type: "GENERAL",
          ownerId: firstUser.id,
          isPublic: true,
          maxMembers: 100,
        },
      }),
    ]);

    console.log(`✅ Created ${groups.length} community groups:`);
    groups.forEach(group => {
      console.log(`   - ${group.name} (${group.type})`);
    });

    // Create some sample training modules
    const trainingModules = await Promise.all([
      prisma.trainingModule.create({
        data: {
          title: "Basic First Aid",
          description: "Learn essential first aid skills including CPR, wound care, and emergency response basics.",
          content: `# Basic First Aid Training

## Module Overview
This module covers essential first aid skills that every emergency responder should know.

## Learning Objectives
- Perform basic CPR
- Treat common wounds and injuries
- Recognize signs of shock
- Handle emergency situations calmly

## Content

### 1. CPR (Cardiopulmonary Resuscitation)
- Check for responsiveness
- Call for help (911)
- Position hands correctly on chest
- Perform 30 chest compressions
- Give 2 rescue breaths
- Continue cycles until help arrives

### 2. Wound Care
- Clean hands before treating wounds
- Apply direct pressure to stop bleeding
- Clean wound with clean water
- Apply sterile bandage
- Monitor for signs of infection

### 3. Shock Recognition
Signs of shock:
- Pale, cold, clammy skin
- Rapid weak pulse
- Rapid breathing
- Weakness or fatigue
- Nausea or vomiting

Treatment:
- Keep person lying down
- Elevate legs if no spinal injury
- Keep warm with blankets
- Do not give food or water

### 4. Emergency Response
- Stay calm and assess the situation
- Ensure scene safety
- Call for professional help
- Provide care within your training level
- Document what happened

## Quiz Questions
1. How many chest compressions should you give before rescue breaths?
2. What are three signs of shock?
3. When should you NOT move an injured person?

Complete this module to earn your Basic First Aid certification.`,
          difficulty: "BEGINNER",
          duration: 45,
          category: "First Aid",
          isRequired: true,
        },
      }),

      prisma.trainingModule.create({
        data: {
          title: "Disaster Response Coordination",
          description: "Learn how to coordinate emergency response efforts during disasters.",
          content: `# Disaster Response Coordination

## Module Overview
Advanced training for coordinating emergency response during disasters.

## Key Topics
- Incident Command System (ICS)
- Resource management
- Communication protocols
- Volunteer coordination
- Safety protocols

## ICS Basics
The Incident Command System provides a standardized approach to:
- Command and control
- Resource management
- Communication
- Planning and coordination

## Communication Protocols
- Use clear, concise language
- Confirm all messages
- Maintain radio discipline
- Document all communications

## Resource Management
- Track available resources
- Prioritize resource allocation
- Coordinate with other agencies
- Maintain resource accountability

This is an advanced module requiring completion of basic training first.`,
          difficulty: "ADVANCED",
          duration: 90,
          category: "Disaster Response",
          isRequired: false,
        },
      }),

      prisma.trainingModule.create({
        data: {
          title: "Community Emergency Preparedness",
          description: "Help your community prepare for emergencies and disasters.",
          content: `# Community Emergency Preparedness

## Building Resilient Communities

### Emergency Planning
- Develop family emergency plans
- Create communication plans
- Identify evacuation routes
- Establish meeting points

### Emergency Supplies
Essential supplies for 72 hours:
- Water (1 gallon per person per day)
- Non-perishable food
- First aid kit
- Flashlight and batteries
- Battery-powered radio
- Medications
- Important documents

### Community Networks
- Know your neighbors
- Identify vulnerable community members
- Establish neighborhood communication
- Practice emergency drills

### Specific Hazards
Prepare for local hazards:
- Floods: Know evacuation routes
- Earthquakes: Secure heavy objects
- Fires: Clear defensible space
- Severe weather: Have shelter plan

Regular community preparedness builds resilience and saves lives.`,
          difficulty: "INTERMEDIATE",
          duration: 60,
          category: "Preparedness",
          isRequired: false,
        },
      }),
    ]);

    console.log(`✅ Created ${trainingModules.length} training modules:`);
    trainingModules.forEach(module => {
      console.log(`   - ${module.title} (${module.difficulty})`);
    });

    // Create some sample posts in the groups
    const posts = await Promise.all([
      prisma.communityPost.create({
        data: {
          groupId: groups[0].id,
          authorId: firstUser.id,
          title: "Welcome to Downtown Emergency Response Team!",
          content: "Welcome everyone! This group is for coordinating emergency response in the downtown area. Please introduce yourself and let us know your skills and availability.",
          postType: "TEXT",
        },
      }),

      prisma.communityPost.create({
        data: {
          groupId: groups[1].id,
          authorId: firstUser.id,
          title: "Monthly Safety Meeting - This Saturday",
          content: "Our monthly neighborhood safety meeting is this Saturday at 10 AM at the community center. We'll discuss recent incidents and review our emergency procedures.",
          postType: "EVENT",
        },
      }),

      prisma.communityPost.create({
        data: {
          groupId: groups[2].id,
          authorId: firstUser.id,
          content: "Just completed the Basic First Aid module! The CPR section was really helpful. Has anyone practiced the techniques with a training dummy?",
          postType: "TEXT",
        },
      }),
    ]);

    console.log(`✅ Created ${posts.length} community posts`);

    console.log("\n🎉 Community data seeding completed successfully!");
    console.log("\nYou can now:");
    console.log("- Browse community groups");
    console.log("- Join groups and participate in discussions");
    console.log("- Take training modules");
    console.log("- Create your own groups");

  } catch (error) {
    console.error("❌ Error seeding community data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
seedCommunityData();