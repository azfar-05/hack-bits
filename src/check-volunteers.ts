import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('=== CHECKING VOLUNTEER SETUP ===\n');

    // Check all users
    const users = await prisma.user.findMany({
        include: { volunteerProfile: true },
    });

    console.log('--- All Users ---');
    users.forEach((u) => {
        console.log(`\nUser: ${u.email}`);
        console.log(`  Role: ${u.role}`);
        console.log(`  ID: ${u.id}`);
        if (u.volunteerProfile) {
            console.log(`  Volunteer Profile:`);
            console.log(`    Available: ${u.volunteerProfile.available}`);
            console.log(`    Latitude: ${u.volunteerProfile.latitude}`);
            console.log(`    Longitude: ${u.volunteerProfile.longitude}`);
            console.log(`    Updated: ${u.volunteerProfile.updatedAt}`);
        } else if (u.role === 'VOLUNTEER') {
            console.log(`  ⚠️  NO VOLUNTEER PROFILE (This is the problem!)`);
        }
    });

    // Check rescue requests
    console.log('\n\n--- Rescue Requests ---');
    const requests = await prisma.rescueRequest.findMany({
        include: {
            user: { select: { email: true } },
            volunteer: { select: { email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
    });

    requests.forEach((r) => {
        console.log(`\nRequest ID: ${r.id}`);
        console.log(`  User: ${r.user.email}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Volunteer: ${r.volunteer?.email || 'None'}`);
        console.log(`  Location: ${r.latitude}, ${r.longitude}`);
        console.log(`  Created: ${r.createdAt}`);
    });

    // Check if volunteers have profiles
    const volunteersWithoutProfiles = await prisma.user.findMany({
        where: {
            role: 'VOLUNTEER',
            volunteerProfile: null,
        },
    });

    if (volunteersWithoutProfiles.length > 0) {
        console.log('\n\n⚠️  PROBLEM FOUND:');
        console.log(`${volunteersWithoutProfiles.length} volunteer(s) missing VolunteerProfile:`);
        volunteersWithoutProfiles.forEach(v => {
            console.log(`  - ${v.email} (ID: ${v.id})`);
        });
        console.log('\nCreating missing profiles...');

        for (const volunteer of volunteersWithoutProfiles) {
            await prisma.volunteerProfile.create({
                data: {
                    userId: volunteer.id,
                    available: true,
                },
            });
            console.log(`  ✓ Created profile for ${volunteer.email}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
