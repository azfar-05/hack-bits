import { PrismaClient } from "~/generated/prisma";

const prisma = new PrismaClient();

async function seedSafetyGuides() {
  try {
    console.log("🌱 Seeding safety guides...");

    // Create safety guides for different disaster types
    const guides = await Promise.all([
      prisma.safetyGuide.upsert({
        where: { disasterType: "FLOOD" },
        update: {
          content: `# Flood Safety Guide

## Before a Flood
- Know your evacuation routes
- Keep emergency supplies ready (water, food, flashlight, radio)
- Move important documents to higher ground
- Have a family communication plan

## During a Flood
- **NEVER drive through flooded roads** - Turn Around, Don't Drown!
- Move to higher ground immediately
- Stay away from electrical equipment if you're wet
- Listen to emergency broadcasts for updates
- If trapped, signal for help from the highest point

## After a Flood
- Wait for authorities to declare area safe
- Avoid walking in moving water
- Be aware of contaminated floodwater
- Document damage with photos for insurance
- Throw away food that came in contact with floodwater

## Emergency Numbers
- Emergency Services: 911
- Local Emergency Management: [Your local number]
- Red Cross: 1-800-RED-CROSS

Stay safe and follow official evacuation orders!`,
        },
        create: {
          disasterType: "FLOOD",
          content: `# Flood Safety Guide

## Before a Flood
- Know your evacuation routes
- Keep emergency supplies ready (water, food, flashlight, radio)
- Move important documents to higher ground
- Have a family communication plan

## During a Flood
- **NEVER drive through flooded roads** - Turn Around, Don't Drown!
- Move to higher ground immediately
- Stay away from electrical equipment if you're wet
- Listen to emergency broadcasts for updates
- If trapped, signal for help from the highest point

## After a Flood
- Wait for authorities to declare area safe
- Avoid walking in moving water
- Be aware of contaminated floodwater
- Document damage with photos for insurance
- Throw away food that came in contact with floodwater

## Emergency Numbers
- Emergency Services: 911
- Local Emergency Management: [Your local number]
- Red Cross: 1-800-RED-CROSS

Stay safe and follow official evacuation orders!`,
        },
      }),

      prisma.safetyGuide.upsert({
        where: { disasterType: "EARTHQUAKE" },
        update: {
          content: `# Earthquake Safety Guide

## Before an Earthquake
- Secure heavy furniture and appliances
- Know safe spots in each room (under sturdy tables)
- Keep emergency supplies accessible
- Practice Drop, Cover, and Hold On

## During an Earthquake
- **DROP** to hands and knees
- **COVER** your head and neck under a sturdy table
- **HOLD ON** to your shelter and protect your head
- If outdoors, move away from buildings and power lines
- If driving, pull over and stop safely

## After an Earthquake
- Check for injuries and hazards
- Be prepared for aftershocks
- Use stairs, not elevators
- Stay out of damaged buildings
- Listen to emergency broadcasts

## What NOT to Do
- Don't run outside during shaking
- Don't stand in doorways
- Don't use matches or lighters (gas leaks possible)

## Emergency Kit Essentials
- Water (1 gallon per person per day)
- Non-perishable food
- First aid kit
- Flashlight and batteries
- Battery-powered radio

Be prepared - earthquakes strike without warning!`,
        },
        create: {
          disasterType: "EARTHQUAKE",
          content: `# Earthquake Safety Guide

## Before an Earthquake
- Secure heavy furniture and appliances
- Know safe spots in each room (under sturdy tables)
- Keep emergency supplies accessible
- Practice Drop, Cover, and Hold On

## During an Earthquake
- **DROP** to hands and knees
- **COVER** your head and neck under a sturdy table
- **HOLD ON** to your shelter and protect your head
- If outdoors, move away from buildings and power lines
- If driving, pull over and stop safely

## After an Earthquake
- Check for injuries and hazards
- Be prepared for aftershocks
- Use stairs, not elevators
- Stay out of damaged buildings
- Listen to emergency broadcasts

## What NOT to Do
- Don't run outside during shaking
- Don't stand in doorways
- Don't use matches or lighters (gas leaks possible)

## Emergency Kit Essentials
- Water (1 gallon per person per day)
- Non-perishable food
- First aid kit
- Flashlight and batteries
- Battery-powered radio

Be prepared - earthquakes strike without warning!`,
        },
      }),

      prisma.safetyGuide.upsert({
        where: { disasterType: "FIRE" },
        update: {
          content: `# Fire Safety Guide

## Fire Prevention
- Install smoke detectors and check batteries monthly
- Keep fire extinguishers accessible
- Create and practice escape plans
- Clear vegetation around your home (defensible space)
- Store flammable materials safely

## During a Fire Emergency
- **GET OUT FAST** - You have less than 2 minutes
- Feel doors before opening (if hot, use alternate route)
- Stay low under smoke
- Once out, STAY OUT - never go back inside
- Call 911 from a safe location

## Wildfire Evacuation
- Follow evacuation orders immediately
- Take evacuation routes specified by authorities
- Bring emergency supplies and important documents
- Wear protective clothing (long sleeves, pants)
- Keep car windows closed, use recirculated air

## If Trapped by Fire
- Close doors between you and fire
- Seal cracks with wet towels
- Signal for help from windows
- Call 911 and report your location

## Home Fire Safety
- Have working smoke alarms on every level
- Keep escape routes clear
- Practice fire escape plan with family
- Know two ways out of every room

## Emergency Supplies for Wildfire
- N95 masks for smoke protection
- Battery-powered radio
- Flashlights and extra batteries
- First aid kit
- Important documents in waterproof container

Remember: Things can be replaced, lives cannot!`,
        },
        create: {
          disasterType: "FIRE",
          content: `# Fire Safety Guide

## Fire Prevention
- Install smoke detectors and check batteries monthly
- Keep fire extinguishers accessible
- Create and practice escape plans
- Clear vegetation around your home (defensible space)
- Store flammable materials safely

## During a Fire Emergency
- **GET OUT FAST** - You have less than 2 minutes
- Feel doors before opening (if hot, use alternate route)
- Stay low under smoke
- Once out, STAY OUT - never go back inside
- Call 911 from a safe location

## Wildfire Evacuation
- Follow evacuation orders immediately
- Take evacuation routes specified by authorities
- Bring emergency supplies and important documents
- Wear protective clothing (long sleeves, pants)
- Keep car windows closed, use recirculated air

## If Trapped by Fire
- Close doors between you and fire
- Seal cracks with wet towels
- Signal for help from windows
- Call 911 and report your location

## Home Fire Safety
- Have working smoke alarms on every level
- Keep escape routes clear
- Practice fire escape plan with family
- Know two ways out of every room

## Emergency Supplies for Wildfire
- N95 masks for smoke protection
- Battery-powered radio
- Flashlights and extra batteries
- First aid kit
- Important documents in waterproof container

Remember: Things can be replaced, lives cannot!`,
        },
      }),
    ]);

    console.log(`✅ Created/updated ${guides.length} safety guides:`);
    guides.forEach(guide => {
      console.log(`   - ${guide.disasterType} Safety Guide`);
    });

    console.log("\n🎉 Safety guides seeding completed successfully!");

  } catch (error) {
    console.error("❌ Error seeding safety guides:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedSafetyGuides();