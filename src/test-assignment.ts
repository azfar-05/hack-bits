import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('=== TESTING VOLUNTEER ASSIGNMENT ===\n');

    // Check volunteers
    const volunteers = await prisma.user.findMany({
        where: { role: 'VOLUNTEER' },
        include: {
            volunteerProfile: true,
            volunteerAssignments: {
                where: {
                    status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
                }
            }
        },
    });

    console.log(`Found ${volunteers.length} volunteer(s):\n`);
    volunteers.forEach(v => {
        console.log(`✓ ${v.email}`);
        console.log(`  Profile: ${v.volunteerProfile ? 'Yes' : 'No'}`);
        if (v.volunteerProfile) {
            console.log(`  Available: ${v.volunteerProfile.available}`);
            console.log(`  Location: ${v.volunteerProfile.latitude}, ${v.volunteerProfile.longitude}`);
        }
        console.log(`  Active assignments: ${v.volunteerAssignments.length}`);
        console.log('');
    });

    // Check recent rescue requests
    const requests = await prisma.rescueRequest.findMany({
        include: {
            user: { select: { email: true } },
            volunteer: { select: { email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
    });

    console.log(`\nRecent rescue requests (last 5):\n`);
    requests.forEach(r => {
        const statusEmoji = {
            'PENDING': '⏳',
            'ASSIGNED': '✅',
            'IN_PROGRESS': '🚀',
            'COMPLETED': '✔️',
            'NO_VOLUNTEER': '⚠️'
        }[r.status] || '❓';

        console.log(`${statusEmoji} ${r.status}`);
        console.log(`  User: ${r.user.email}`);
        console.log(`  Volunteer: ${r.volunteer?.email || 'None'}`);
        console.log(`  Created: ${r.createdAt.toLocaleString()}`);
        console.log('');
    });

    // Summary
    const stats = {
        pending: requests.filter(r => r.status === 'PENDING').length,
        assigned: requests.filter(r => r.status === 'ASSIGNED').length,
        inProgress: requests.filter(r => r.status === 'IN_PROGRESS').length,
        noVolunteer: requests.filter(r => r.status === 'NO_VOLUNTEER').length,
    };

    console.log('\n=== SUMMARY ===');
    console.log(`Volunteers ready: ${volunteers.filter(v => v.volunteerProfile?.available).length}/${volunteers.length}`);
    console.log(`Pending requests: ${stats.pending}`);
    console.log(`Assigned requests: ${stats.assigned}`);
    console.log(`In progress: ${stats.inProgress}`);
    console.log(`No volunteer: ${stats.noVolunteer}`);

    if (volunteers.length === 0) {
        console.log('\n⚠️  No volunteers in the system. Please create a volunteer account.');
    } else if (volunteers.every(v => !v.volunteerProfile)) {
        console.log('\n⚠️  Volunteers exist but have no profiles. Run setup-volunteers.ts');
    } else if (volunteers.every(v => v.volunteerProfile && !v.volunteerProfile.available)) {
        console.log('\n⚠️  All volunteers are marked as unavailable.');
    } else {
        console.log('\n✓ System is ready for assignments!');
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
