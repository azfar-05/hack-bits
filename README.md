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
The system is a real-time disaster communication and coordination platform. Authorities broadcast disaster alerts and safety instructions to affected areas. Citizens send SOS rescue requests and view alerts; volunteers receive nearby SOS requests and accept/complete rescues; authorities monitor danger zones, manage escalated cases, and manually assign volunteers. Safety guides are cached in the browser for offline reading after they have been loaded once online.

---

## Innovation & Creativity
The solution provides a unified, multi-role platform: real-time alerting, SOS creation with automatic volunteer matching by proximity, volunteer coordination with live location and status updates, and rule-based danger zone risk scoring. Safety guide content is cached in localStorage so users can read it when offline.

---

## Technical Complexity & Stack
**Frontend:**
- Next.js 15 (TypeScript)
- Tailwind CSS
- No service worker or PWA manifest; offline support is limited to cached safety guide content in localStorage

**Backend:**
- tRPC for end-to-end type-safe APIs
- Polling for updates (5–30 second intervals depending on dashboard and data type)

**Database:**
- PostgreSQL with Prisma ORM

**Authentication:**
- Firebase Authentication with role-based access (USER, VOLUNTEER, AUTHORITY) implemented using Firebase custom claims and backend authorization checks.
- Google OAuth and credentials (email + password) providers
- New users get USER role by default; VOLUNTEER and AUTHORITY roles are assigned via admin (e.g. promote API or database)

**Maps & Location:**
- Leaflet with OpenStreetMap tiles
- Volunteer live location tracking with periodic server updates
- Geospatial rescue request assignment (2 km → 5 km → 10 km radius search)

**Notifications:**
- In-app visual and audio notifications for new volunteer alerts
- Firebase configuration is present in env but not used for push/SMS
- No mock SMS in UI; console logging may exist in code

**Deployment:**
- Vercel-ready configuration

---

## Usability & Impact
**Users:**
- Citizens (USER role): receive disaster alerts, send SOS, cancel with “I’m Safe,” read safety guides (cached for offline)
- Volunteers (VOLUNTEER role): accept nearby SOS, update rescue status, share location, create safe zones
- Authorities (AUTHORITY role): create alerts and safety guides, view danger zones and risk scores, handle escalated cases, manually assign volunteers

**Impact:**
The system improves situational awareness and coordination during disasters by linking citizens, volunteers, and authorities in one workflow with real-time polling and proximity-based assignment.

---

## Key Features (Currently Implemented)

### USER Dashboard
- **SOS (Need Help)**: Send rescue request with automatic geolocation capture. Only one active request per user; duplicate is blocked.
- **I’m Safe**: Cancel active rescue request (marks it completed and frees volunteer if assigned).
- **ETA display**: Estimated help arrival time (min–max minutes) and confidence (HIGH/MEDIUM/LOW). Rule-based prediction using distance, volunteer status, system load, and disaster severity. Shown when a volunteer is assigned.
- **Alert feed**: Location-based disaster alerts; only alerts within whose radius the user falls are shown. Auto-refresh every 30 s when online. Requires network; no offline alert list.
- **Safety guides**: One guide per disaster type (Flood, Earthquake, Fire). Fetched when online; content is cached in localStorage and shown when offline or when server is unavailable.
- **Alerts map**: Map of nearby alerts and user location (when location and alerts are available).
- **Training link**: Navigate to training page.
- **Emergency Chat**: Opens real-time communication UI (realtime channels/messaging).
- **Profile**: Navigate to profile; profile completion flow (name, phone, address, location) for new users.

### VOLUNTEER Dashboard
- **Unified request list**: Single polling query (every 5 s) for assigned, pending, and escalated (NO_VOLUNTEER) rescue requests.
- **Accept request**: Accept pending or NO_VOLUNTEER requests (up to 3 active assignments per volunteer).
- **Status updates**: Set rescue status to In Progress or Completed.
- **ETA**: ETA and confidence shown on assigned requests; rule-based prediction on accept and on assignment.
- **Location tracking**: GPS sent to server on start and on position updates (periodic, e.g. 15 s). Availability toggle (available/unavailable) for assignment eligibility.
- **Live map**: Map of assigned user location(s) and volunteer location with distance; “Locate me” and fullscreen controls; marker click zooms and shows popup.
- **New-alert notifications**: Visual banner and optional audio when new alerts appear in the list.
- **Safe zone creation**: Create shelters, camps, or hospitals with name, type, location, optional capacity; visible to authority map.
- **Resource nodes**: Add and view resource nodes (e.g. boat, generator, water, food, medical); view nearby resources; used in coordination.
- **Training**: Training dashboard and modules.
- **Emergency Chat**: Real-time communication UI.

### AUTHORITY Dashboard
- **Command / live map**: Map showing danger zones (risk-colored), safe zones, and rescue/volunteer data (e.g. AuthorityCommandMap, live map, predictive analytics map components).
- **Danger zones**: Rule-based risk scoring from recent RescueRequests (grid aggregation). Formula: `(Recent SOS × 3) + (Unknown Users × 4) + (Growth Rate × 5)`. Risk levels: HIGH (>25), MEDIUM (13–25), LOW (≤12). Recent window 15 minutes; growth = recent vs previous 15 minutes.
- **Escalated cases**: List of NO_VOLUNTEER requests; ETA and details shown; manual assignment to a volunteer.
- **Manual assignment**: Assign a specific volunteer to an escalated (or eligible) request; ETA recalculated after assign.
- **Volunteer list**: All volunteers with location and availability; used for manual assign and overview.
- **Alert broadcasting**: Create alerts with title, message, disaster type (Flood, Earthquake, Fire), center (lat/lng), and radius (5–30 km). Alerts shown to users inside radius.
- **Safety guide management**: Create/update one safety guide per disaster type (FLOOD, EARTHQUAKE, FIRE). Users and volunteers fetch by type; USER dashboard caches content for offline.
- **All rescue requests**: List of non-completed requests for operations overview.
- **Safe zones**: View all safe zones (shelters, camps, hospitals) on map and in lists.
- **Drone / social / training**: Drone swarm dashboard, social media dashboard, training dashboard, real-time communication UI (demo/supplementary features).

### Technical Features
- **Auto-assignment**: On SOS create (and on public createSOS), search for available volunteers in 2 km, then 5 km, then 10 km; assign closest. If none found, request stays PENDING. Authority dashboard lists escalated (NO_VOLUNTEER) requests for manual assignment; NO_VOLUNTEER can be set in the database or by an external process. Volunteer max 3 active assignments; availability flag respected.
- **ETA prediction**: Rule-based (no external ML model). Inputs: distance, volunteer busy flag, active rescues count, disaster type, volunteer availability. Output: min/max minutes, confidence, and factors list. Used on assign and on accept.
- **Real-time polling**: Volunteer dashboard 5 s; user alerts 30 s; authority data 10–30 s depending on query.
- **Geospatial**: Haversine distance for volunteer–request matching and display.
- **Role-based API**: Procedures check session role (USER, VOLUNTEER, AUTHORITY); routes /user, /volunteer, /authority protected by middleware (auth required).
- **Offline**: Safety guides cached in localStorage after first fetch; no offline SOS queue wired in the UI (queue logic exists in lib but is not used by SOS flow).
- **Responsive UI**: Mobile-friendly layout for emergency use.

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
- Sign in with **email + password** (or Google / GitHub). New users are created with **USER** role.
- There is no “select role” on the login page. To use VOLUNTEER or AUTHORITY dashboards, assign the role in the database or via the promote API: `POST /api/admin/promote` with body `{ "email": "user@example.com", "secretKey": "PROMOTE_ADMIN_SECRET_2024" }` (creates or promotes user to AUTHORITY). VOLUNTEER must be set in the database (e.g. `User.role = VOLUNTEER`).

### User Roles

| Role | Access |
|------|--------|
| **USER** | Send SOS, cancel with “I’m Safe,” view location-based alerts, read safety guides (cached for offline) |
| **VOLUNTEER** | Accept rescues, update status, track location, create safe zones and resources, manage assignments |
| **AUTHORITY** | Create alerts and safety guides, view danger zones and risk, handle escalated cases, manually assign volunteers |

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
│   ├── offline.ts                # localStorage caching for safety guides
│   ├── offline-queue.ts          # Offline SOS queue (not wired to UI)
│   └── eta-prediction.ts         # Rule-based ETA prediction
├── server/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── alert.ts          # Alert CRUD
│   │   │   ├── guide.ts         # Safety guide CRUD
│   │   │   ├── rescue.ts        # SOS / rescue request flow, auto-assign, ETA
│   │   │   ├── volunteer.ts     # Volunteer location & availability
│   │   │   ├── dangerZone.ts    # Risk scoring for danger zones
│   │   │   └── safeZone.ts      # Safe zone management
│   │   ├── root.ts               # tRPC router
│   │   └── trpc.ts               # tRPC context & procedures
│   ├── auth/                     # NextAuth configuration
│   └── db.ts                     # Prisma client
├── trpc/                         # tRPC client setup
├── middleware.ts                 # Route protection (auth required for /user, /volunteer, /authority)
└── styles/
prisma/
└── schema.prisma                 # Database schema
```

## Presentation Link
- https://www.canva.com/design/DAG_65CC_cg/KL73tiGznQINxlJE1pQL4A/view?utm_content=DAG_65CC_cg&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h2b7a8357b5
---


