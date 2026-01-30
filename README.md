# Project Name
🚨 Real-Time Disaster Alert & Rescue Coordination System

# Problem Statement ID
CS04DS

# Team Name
HackBits

# College Name
NMAM Institute of Technology

---

## Problem Statement
During disasters, communication breakdowns, delayed rescue coordination, and lack of real-time situational awareness often lead to loss of lives. Existing disaster management systems are largely one-way and fail to provide offline access, real-time escalation, and effective coordination between authorities, volunteers, and affected citizens at scale.

---

## Proposed Solution
The proposed system is a real-time, offline-capable disaster communication and coordination platform that enables authorities, volunteers, and citizens to interact efficiently during emergencies. Authorities can broadcast disaster alerts and safety instructions to affected areas. Citizens can respond with their safety status or request help, while volunteers receive nearby SOS requests and assist in rescue coordination. The platform is designed to continue functioning in low or no internet conditions using offline caching and fallback communication mechanisms.

---

## Innovation & Creativity
The solution introduces a unified, multi-role disaster communication platform that goes beyond traditional alert-only systems. It integrates real-time alerting, SOS escalation, volunteer coordination, and offline accessibility within a single workflow. By enabling two-way communication and real-time escalation based on incoming data, the system improves situational awareness and supports faster, more coordinated disaster response.

---

## Technical Complexity & Stack
**Frontend:**
- Next.js 15 (TypeScript)
- Tailwind CSS
- Progressive Web App (PWA) capabilities for offline support

**Backend:**
- tRPC for end-to-end type-safe APIs
- Real-time updates via polling (5-30 second intervals)

**Database:**
- PostgreSQL with Prisma ORM
- Geospatial calculations using Haversine formula

**Authentication:**
- NextAuth v5 with role-based access (USER/VOLUNTEER/AUTHORITY)
- Google OAuth, GitHub OAuth, and credentials providers

**Maps & Location:**
- Leaflet with OpenStreetMap tiles
- Live location tracking for volunteers
- Geospatial rescue request assignment

**Notifications:**
- Mock SMS notifications (console logging)
- Firebase configuration ready (not actively used)

**Deployment:**
- Vercel-ready configuration

---

## Usability & Impact
**Users:**
- Citizens affected by disasters
- Registered volunteers
- Disaster management authorities

**User Interaction:**
- **Citizens (USER role)**: Receive disaster alerts and safety guides, send SOS requests with "I need help" button, cancel requests with "I am safe" button, access offline safety information via localStorage caching.
- **Volunteers (VOLUNTEER role)**: Receive nearby SOS requests via live polling, accept rescue tasks, share live location tracking, update rescue status (assigned → in progress → completed), create safe zones (shelters, camps, hospitals).
- **Authorities (AUTHORITY role)**: Send disaster alerts (flood, earthquake, fire), monitor live danger zone heatmaps with risk scoring, view escalated cases requiring manual intervention, manually assign volunteers to critical requests, create and manage safety guides.

**Impact:**
The system improves disaster preparedness and response by enabling faster communication, better coordination, and real-time situational awareness. It helps save lives during connectivity failures, enables quicker rescue operations, and scales from local to large-scale disaster scenarios.

---

## Key Features (Currently Implemented)

### USER Dashboard
- **SOS Emergency Button**: Send rescue requests with automatic geolocation capture
- **Safety Status**: Cancel active requests with "I am safe" button  
- **Alert Feed**: Real-time disaster alerts with auto-refresh (30s intervals)
- **Safety Guides**: Disaster-specific instructions with offline caching
- **Offline Support**: Safety guides cached in localStorage for offline access
- **Post-SOS Details**: Add emergency type and notes after sending SOS

### VOLUNTEER Dashboard  
- **Live Rescue Coordination**: Accept pending SOS requests from nearby users
- **Auto-Assignment**: Receive requests based on proximity (2km → 5km → 10km radius expansion)
- **Status Management**: Update rescue progress (assigned → in progress → completed)
- **Location Tracking**: Continuous GPS tracking with 15-second server updates
- **Live Map**: View assigned user locations with distance calculations
- **Alert Notifications**: Audio alerts and visual notifications for new requests
- **Safe Zone Creation**: Create shelters, camps, and hospitals visible to authorities
- **Availability Toggle**: Set online/offline status for assignment eligibility

### AUTHORITY Dashboard
- **Command Center Map**: Live view of Karnataka state with danger zones and safe zones
- **Risk Assessment**: Rule-based scoring system for danger zones:
  - Formula: `(Recent SOS × 3) + (Unknown Users × 4) + (Growth Rate × 5)`
  - Risk levels: HIGH (>25), MEDIUM (13-25), LOW (≤12)
- **Escalated Cases**: Manual intervention for NO_VOLUNTEER requests
- **Volunteer Management**: View all volunteers with location, availability, and active assignments
- **Manual Assignment**: Assign specific volunteers to critical cases
- **Alert Broadcasting**: Create and send disaster alerts (flood, earthquake, fire)
- **Safety Guide Management**: Create disaster-specific safety instructions
- **Operations Overview**: Real-time statistics and status monitoring

### Technical Features
- **Auto-Assignment Algorithm**: Intelligent volunteer matching with radius expansion
- **Offline Queue**: SOS requests queued in localStorage when offline, synced when online
- **Real-time Polling**: Live updates every 5-30 seconds across all dashboards
- **Geospatial Calculations**: Haversine distance formula for proximity matching
- **Role-based Security**: Strict API access control and route protection
- **Responsive Design**: Mobile-first interface for emergency situations

---

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or pnpm

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your database URL:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/hack-bits"
   AUTH_SECRET="your-secret-key-here"
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Generate Prisma client and push schema to database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Login

The system uses a credentials-based login for demo purposes:
- Enter any email address
- Select a role (User, Volunteer, or Authority)
- Click "Sign In"

New users are automatically created on first login.

### User Roles

| Role | Access |
|------|--------|
| **USER** | Send SOS requests, view disaster alerts, access offline safety guides |
| **VOLUNTEER** | Accept rescue requests, track location, create safe zones, manage assignments |
| **AUTHORITY** | Create alerts/guides, monitor danger zones, manage escalated cases, assign volunteers |

### File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth API route
│   │   └── trpc/[trpc]/          # tRPC API route
│   ├── authority/                # Authority dashboard
│   ├── components/               # Shared components
│   ├── dashboard/                # Role-based redirect
│   ├── user/                     # User dashboard
│   ├── volunteer/                # Volunteer dashboard
│   ├── layout.tsx
│   └── page.tsx                  # Login page
├── lib/
│   ├── offline.ts                # localStorage caching utilities
│   └── offline-queue.ts          # Offline SOS queue management
├── server/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── alert.ts          # Alert CRUD operations
│   │   │   ├── guide.ts          # Safety guide CRUD
│   │   │   ├── rescue.ts         # SOS/rescue request logic
│   │   │   ├── volunteer.ts      # Volunteer location & availability
│   │   │   ├── dangerZone.ts     # Risk assessment calculations
│   │   │   └── safeZone.ts       # Safe zone management
│   │   ├── root.ts               # tRPC router
│   │   └── trpc.ts               # tRPC context & procedures
│   ├── auth/                     # NextAuth configuration
│   └── db.ts                     # Prisma client
├── trpc/                         # tRPC client setup
├── middleware.ts                 # Route protection
└── styles/
prisma/
└── schema.prisma                 # Database schema
```

---

## Presentation / Demo Link (Optional)
To be added if available.