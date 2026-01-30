import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('=== SETTING UP VOLUNTEER PROFILES ===\n');

    // Find all volunteers
    const volunteers = await prisma.user.findMany({
        where: { role: 'VOLUNTEER' },
        include: { volunteerProfile: true },
    });

    if (volunteers.length === 0) {
        console.log('❌ No volunteers found in the system.');
        console.log('Please create a volunteer account first.');
        return;
    }

    console.log(`Found ${volunteers.length} volunteer(s):\n`);

    for (const volunteer of volunteers) {
        console.log(`Volunteer: ${volunteer.email}`);

        if (!volunteer.volunteerProfile) {
            // Create profile with a default location (you can change this)
            // Using a location in India as default
            const profile = await prisma.volunteerProfile.create({
                data: {
                    userId: volunteer.id,
                    latitude: 28.6139,  // Delhi coordinates as example
                    longitude: 77.2090,
                    available: true,
                },
            });
            console.log(`  ✓ Created profile with location: ${profile.latitude}, ${profile.longitude}`);
            console.log(`  ✓ Status: Available`);
        } else {
            console.log(`  Profile exists:`);
            console.log(`    Location: ${volunteer.volunteerProfile.latitude}, ${volunteer.volunteerProfile.longitude}`);
            console.log(`    Available: ${volunteer.volunteerProfile.available}`);

            // If no location, add one
            if (!volunteer.volunteerProfile.latitude || !volunteer.volunteerProfile.longitude) {
                await prisma.volunteerProfile.update({
                    where: { id: volunteer.volunteerProfile.id },
                    data: {
                        latitude: 28.6139,
                        longitude: 77.2090,
                    },
                });
                console.log(`  ✓ Added default location`);
            }
        }
        console.log('');
    }

    console.log('\n=== TESTING AUTO-ASSIGNMENT ===\n');

    // Check if there are any pending requests
    const pendingRequests = await prisma.rescueRequest.findMany({
        where: { status: 'PENDING' },
        include: { user: { select: { email: true } } },
    });

    if (pendingRequests.length > 0) {
        console.log(`Found ${pendingRequests.length} pending request(s):`);
        pendingRequests.forEach(req => {
            console.log(`  - Request from ${req.user.email} at ${req.latitude}, ${req.longitude}`);
        });
    } else {
        console.log('No pending requests.');
    }

    // Check escalated requests
    const escalatedRequests = await prisma.rescueRequest.findMany({
        where: { status: 'NO_VOLUNTEER' },
        include: { user: { select: { email: true } } },
    });

    if (escalatedRequests.length > 0) {
        console.log(`\nFound ${escalatedRequests.length} escalated request(s) (NO_VOLUNTEER):`);
        escalatedRequests.forEach(req => {
            console.log(`  - Request from ${req.user.email} at ${req.latitude}, ${req.longitude}`);
        });
        console.log('\nThese requests need manual assignment by an authority.');
    }

    console.log('\n✓ Setup complete! Volunteers should now receive assignments.');
    console.log('\nNOTE: When volunteers log in, their browser will request location permission.');
    console.log('They must ALLOW location access for the auto-assignment to work properly.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
