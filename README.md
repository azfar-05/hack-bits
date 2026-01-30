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
- Next.js (TypeScript)
- Tailwind CSS
- Progressive Web App (PWA) for offline support

**Backend:**
- tRPC for end-to-end type-safe APIs
- WebSockets / Socket.IO for real-time updates

**Database:**
- PostgreSQL
- PostGIS for geospatial queries and SOS clustering
- Prisma ORM

**Authentication:**
- NextAuth with role-based access (User / Volunteer / Authority)

**Maps & Location:**
- Google Maps API / OpenStreetMap
- Geo-fencing and live location tracking

**Notifications:**
- Firebase Cloud Messaging (FCM) for push notifications
- Twilio / AWS SNS for SMS fallback
- WhatsApp Business API for emergency contact alerts

**Deployment:**
- Vercel (Frontend)
- Railway / Supabase (Backend & Database)

---

## Usability & Impact
**Users:**
- Citizens affected by disasters
- Registered volunteers
- Disaster management authorities

**User Interaction:**
- Citizens receive disaster alerts and safety guides, respond with “I am safe” or “I need help,” and access offline safety information.
- Volunteers receive nearby SOS requests, accept rescue tasks, share live location and ETA, and update rescue status in real time.
- Authorities send geo-fenced alerts, monitor live SOS heatmaps, detect SOS clusters, and dispatch large-scale rescue operations.

**Impact:**
The system improves disaster preparedness and response by enabling faster communication, better coordination, and real-time situational awareness. It helps save lives during connectivity failures, enables quicker rescue operations, and scales from local to large-scale disaster scenarios.

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
| **USER** | View disaster alerts, access offline safety guides |
| **VOLUNTEER** | Placeholder dashboard (SOS features coming soon) |
| **AUTHORITY** | Create/send disaster alerts, manage safety guides |

### Key Features (MVP)

- **Authentication**: Role-based access control with NextAuth
- **Disaster Alerts**: Authorities can broadcast alerts (Flood, Earthquake, Fire)
- **Safety Guides**: Authorities can create safety instructions per disaster type
- **Offline Support**: Safety guides are cached in localStorage for offline access
- **Real-time Updates**: Alert feed auto-refreshes every 30 seconds

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
│   └── offline.ts                # localStorage caching utilities
├── server/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── alert.ts          # Alert CRUD operations
│   │   │   └── guide.ts          # Safety guide CRUD
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
