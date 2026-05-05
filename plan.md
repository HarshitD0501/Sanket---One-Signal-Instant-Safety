# 🛡️ Sanket — Women Safety SOS App
## Complete Implementation Plan

---

## 📌 Problem Statement

Women facing unsafe situations often cannot type messages or navigate complex apps. They need a **one-tap or shake-activated emergency system** that instantly alerts trusted contacts, shares live location, and connects them with help — all without requiring the attacker to notice.

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ SOS Page │ │ Map View │ │ Contacts │ │ Tracking Link  │  │
│  │ (Big Red │ │ (Google  │ │ (Manage  │ │ (Public share  │  │
│  │  Button) │ │  Maps)   │ │  list)   │ │  page)         │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       │             │            │                │           │
│       └─────────────┴────────────┴────────────────┘           │
│                          │ Axios + Socket.IO                  │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                   BACKEND (Node.js + Express)                │
│                          │                                    │
│  ┌───────────────────────┼────────────────────────────────┐  │
│  │              REST API + Socket.IO Server                │  │
│  └──┬──────────────┬─────────────────┬────────────────┬───┘  │
│     │              │                 │                │       │
│  ┌──▼──┐    ┌──────▼──────┐   ┌─────▼──────┐  ┌─────▼────┐ │
│  │Auth │    │  WhatsApp   │   │   Twilio   │  │  Google  │ │
│  │JWT  │    │  Business   │   │   Voice    │  │  Maps    │ │
│  │     │    │  Cloud API  │   │   API      │  │  Places  │ │
│  └──┬──┘    └──────┬──────┘   └─────┬──────┘  └─────┬────┘ │
│     │              │                 │                │       │
│  ┌──▼──────────────▼─────────────────▼────────────────▼────┐ │
│  │                  MongoDB Atlas                          │ │
│  │  users | emergencyContacts | sosEvents | locationHistory│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React.js (Vite) | UI framework |
| **Styling** | CSS (custom design system) | Premium dark-themed UI |
| **State** | React Context + useReducer | Global state management |
| **Maps** | `@react-google-maps/api` | Google Maps in React |
| **Backend** | Node.js + Express.js | REST API server |
| **Database** | MongoDB Atlas (free tier) | Cloud database |
| **ODM** | Mongoose | MongoDB object modeling |
| **Real-time** | Socket.IO | Live location streaming |
| **WhatsApp** | WhatsApp Business Cloud API | Alert messages |
| **Voice** | Twilio Voice API | Emergency auto-calls |
| **Auth** | JWT + bcrypt | User authentication |

---

## 🔑 Prerequisites & API Keys

### 1. Node.js & npm
- Install Node.js v18+ from [nodejs.org](https://nodejs.org)
- Verify: `node -v` and `npm -v`

### 2. MongoDB Atlas (Free)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create free account → Create free cluster (M0 Sandbox)
3. Create database user with password
4. Whitelist your IP (or allow `0.0.0.0/0` for dev)
5. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/sanket`

### 3. Google Maps API Key
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g., "Sanket")
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**
4. Go to **Credentials** → Create API Key
5. (Optional) Restrict key to HTTP referrers for security

### 4. WhatsApp Business Cloud API (Free Sandbox)
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Log in with Facebook → Create App → Choose **"Business"** type
3. Add **WhatsApp** product → Click "Set Up"
4. You'll get:
   - **Temporary access token** (expires in 24h, regenerate as needed)
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
5. Add test recipient numbers (up to 5) in the sandbox settings
6. Test with the provided cURL command to verify it works

### 5. Twilio Account (Free Trial)
1. Go to [twilio.com](https://www.twilio.com) → Sign up
2. You get **$15.50 free trial credit**
3. Get a free Twilio phone number
4. Collect:
   - **Account SID**
   - **Auth Token**
   - **Twilio Phone Number**
5. Verify your personal number for testing (trial accounts can only call verified numbers)

---

## 📂 Project Structure

```
livekit/
├── client/                          # React Frontend (Vite)
│   ├── public/
│   │   └── alarm.mp3               # SOS alarm sound
│   ├── src/
│   │   ├── assets/                 # Images, icons
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Navigation bar
│   │   │   ├── SOSButton.jsx       # Big red SOS button
│   │   │   ├── ShakeDetector.jsx   # Shake-to-SOS logic
│   │   │   ├── LiveMap.jsx         # Google Maps component
│   │   │   ├── SafeZones.jsx       # Nearby safe places on map
│   │   │   ├── ContactCard.jsx     # Emergency contact card
│   │   │   ├── StatusBadge.jsx     # SOS status indicator
│   │   │   └── ProtectedRoute.jsx  # Auth route guard
│   │   ├── context/
│   │   │   ├── AuthContext.jsx     # Auth state
│   │   │   └── SOSContext.jsx      # SOS state & socket
│   │   ├── pages/
│   │   │   ├── Home.jsx            # SOS dashboard (main page)
│   │   │   ├── MapView.jsx         # Full map with safe zones
│   │   │   ├── Contacts.jsx        # Manage emergency contacts
│   │   │   ├── TrackingPage.jsx    # Public live tracking link
│   │   │   ├── Login.jsx           # Login page
│   │   │   ├── Register.jsx        # Registration page
│   │   │   └── Profile.jsx         # User profile
│   │   ├── services/
│   │   │   └── api.js              # Axios instance & API calls
│   │   ├── hooks/
│   │   │   ├── useShake.js         # Shake detection hook
│   │   │   └── useGeolocation.js   # GPS location hook
│   │   ├── styles/
│   │   │   └── index.css           # Global design system
│   │   ├── App.jsx                 # Routes & layout
│   │   └── main.jsx                # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                          # Express Backend
│   ├── config/
│   │   └── db.js                   # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js      # Register, login, profile
│   │   ├── contact.controller.js   # CRUD emergency contacts
│   │   ├── sos.controller.js       # Trigger & manage SOS
│   │   └── tracking.controller.js  # Location updates & history
│   ├── models/
│   │   ├── User.js                 # User schema
│   │   ├── EmergencyContact.js     # Contact schema
│   │   ├── SOSEvent.js             # SOS event schema
│   │   └── LocationHistory.js      # GPS trail schema
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── contact.routes.js
│   │   ├── sos.routes.js
│   │   └── tracking.routes.js
│   ├── services/
│   │   ├── whatsapp.service.js     # WhatsApp Business API calls
│   │   ├── twilio.service.js       # Twilio Voice API calls
│   │   └── maps.service.js         # Google Places API calls
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verification
│   │   └── error.middleware.js     # Global error handler
│   ├── socket/
│   │   └── locationSocket.js       # Socket.IO location streaming
│   ├── server.js                   # Entry point
│   └── package.json
│
├── .env.example                     # Template for env vars
├── plan.md                          # This file
├── PROBLEM_STATEMENTS.md
└── README.md                        # Project README
```

---

## 🗄️ Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,              // "Priya Sharma"
  email: String,             // unique, indexed
  password: String,          // bcrypt hashed
  phone: String,             // "+91XXXXXXXXXX"
  profilePic: String,        // URL (optional)
  lastKnownLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  sosActive: Boolean,        // Is SOS currently active?
  createdAt: Date
}
```

### Emergency Contacts Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,          // ref → Users
  name: String,              // "Mom"
  phone: String,             // "+91XXXXXXXXXX"
  relation: String,          // "Mother", "Friend", "Spouse"
  whatsappEnabled: Boolean,  // Can receive WhatsApp alerts?
  callEnabled: Boolean,      // Can receive voice calls?
  createdAt: Date
}
```

### SOS Events Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,          // ref → Users
  triggerType: String,       // "tap" | "shake"
  status: String,            // "active" | "resolved" | "false_alarm"
  location: {
    lat: Number,
    lng: Number,
    address: String          // Reverse geocoded
  },
  trackingId: String,        // UUID for public tracking link
  notifications: [{
    contactId: ObjectId,
    whatsappSent: Boolean,
    whatsappSentAt: Date,
    voiceCallSid: String,
    voiceCallStatus: String,
    voiceCalledAt: Date
  }],
  resolvedAt: Date,
  createdAt: Date
}
```

### Location History Collection
```javascript
{
  _id: ObjectId,
  sosEventId: ObjectId,      // ref → SOSEvents
  userId: ObjectId,          // ref → Users
  coordinates: [{
    lat: Number,
    lng: Number,
    timestamp: Date
  }]
}
```

---

## 🔌 API Endpoints

### Auth Routes (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Create new user account |
| POST | `/login` | Login, receive JWT token |
| GET | `/profile` | Get logged-in user profile |
| PATCH | `/profile` | Update profile details |

### Emergency Contacts (`/api/contacts`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List all contacts for logged-in user |
| POST | `/` | Add new emergency contact |
| PATCH | `/:id` | Update contact details |
| DELETE | `/:id` | Remove a contact |

### SOS (`/api/sos`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/trigger` | 🚨 Trigger SOS (tap or shake) |
| PATCH | `/:id/resolve` | Mark SOS as resolved |
| GET | `/active` | Get current active SOS (if any) |
| GET | `/history` | Get past SOS events |

### Tracking (`/api/tracking`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/:trackingId` | Public — get live location (no auth) |
| POST | `/update-location` | Push GPS coordinates (authed) |

### Map (`/api/map`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/safe-zones/:lat/:lng` | Get nearby police, hospitals |

---

## ⚡ SOS Trigger Flow (Core Logic)

```
1. User taps SOS button OR shakes phone
                    │
2. Frontend sends POST /api/sos/trigger
   Body: { triggerType: "tap"|"shake", lat, lng }
                    │
3. Backend creates SOSEvent in MongoDB
                    │
4. Backend fetches user's emergency contacts
                    │
5. FOR EACH contact (in parallel):
   ├── 5a. Send WhatsApp message via Business API
   │        Message: "🚨 SOS ALERT! {name} needs help!
   │                  📍 Location: {google maps link}
   │                  🔴 Track live: {tracking link}"
   │
   └── 5b. Initiate Twilio voice call
            TwiML: "<Say>Emergency alert! {name} has
                     triggered an SOS from {address}.
                     Please check on them immediately.
                     Track their location at {link}</Say>"
                    │
6. Backend starts Socket.IO room for this SOS event
                    │
7. Frontend begins streaming GPS coordinates
   every 5 seconds via Socket.IO
                    │
8. Tracking page (public link) receives live
   updates and plots on Google Map
                    │
9. User taps "I'm Safe" → SOS resolved
   → Contacts receive "All clear" WhatsApp message
```

---

## 🎨 UI Design Plan

### Theme
- **Dark mode** primary (safety apps should be discreet at night)
- **Accent color**: `#FF3B5C` (emergency red) + `#00D4AA` (safe green)
- **Font**: Inter (Google Fonts)
- **Glassmorphism** cards with subtle blur effects
- **Smooth animations** on SOS trigger (pulse, ripple)

### Pages

#### 1. Home / SOS Dashboard
- Giant pulsing red SOS button (center)
- Shake-to-SOS toggle switch
- Quick view of emergency contacts (avatars)
- Current location display
- Recent SOS history (mini cards)

#### 2. Map View
- Full-screen Google Map
- User's live location (blue dot)
- Nearby safe zones (markers with icons):
  - 🏥 Hospitals (blue markers)
  - 🚔 Police stations (red markers)
- Safe zone info cards on marker click
- Directions button to navigate

#### 3. Emergency Contacts
- List of contacts with avatars
- Add contact form (name, phone, relation)
- Toggle WhatsApp / Voice call for each
- Edit / Delete actions
- Minimum 1 contact required warning

#### 4. Public Tracking Page
- No login required (accessed via shared link)
- Google Map with live-updating marker
- User's name and SOS timestamp
- Breadcrumb trail of movement
- "Last updated X seconds ago" indicator

---

## 📋 Implementation Order (Task Breakdown)

### Phase 1: Project Setup (Day 1 — ~2 hours)
- [ ] Initialize Vite + React frontend
- [ ] Initialize Express backend
- [ ] Setup MongoDB Atlas connection
- [ ] Create `.env.example` with all required variables
- [ ] Setup project structure (folders, boilerplate)
- [ ] Install all dependencies

### Phase 2: Backend Core (Day 1 — ~3 hours)
- [ ] Create Mongoose models (User, EmergencyContact, SOSEvent, LocationHistory)
- [ ] Build auth system (register, login, JWT middleware)
- [ ] Build CRUD for emergency contacts
- [ ] Build SOS trigger endpoint
- [ ] Setup Socket.IO for location streaming
- [ ] Build tracking endpoint (public)

### Phase 3: Integrations (Day 2 — ~3 hours)
- [ ] WhatsApp Business API service (send SOS alert message)
- [ ] Twilio Voice service (auto-call with TwiML)
- [ ] Google Places API service (nearby police/hospitals)
- [ ] Wire integrations into SOS trigger flow

### Phase 4: Frontend — Auth & Layout (Day 2 — ~2 hours)
- [ ] Design system (CSS variables, animations, components)
- [ ] Login & Register pages
- [ ] Navbar with navigation
- [ ] Auth context & protected routes
- [ ] Axios API service layer

### Phase 5: Frontend — Core Features (Day 3 — ~4 hours)
- [ ] SOS Dashboard (Home page) with big SOS button
- [ ] Shake-to-SOS hook (DeviceMotion API)
- [ ] Emergency Contacts management page
- [ ] Google Maps integration (LiveMap component)
- [ ] Map View page with safe zones
- [ ] SOS trigger flow (connect to backend)

### Phase 6: Frontend — Live Tracking (Day 3 — ~2 hours)
- [ ] Socket.IO client setup
- [ ] GPS streaming on SOS active
- [ ] Public tracking page with live map
- [ ] Breadcrumb trail rendering
- [ ] "I'm Safe" resolve flow

### Phase 7: Polish & Demo (Day 4 — ~2 hours)
- [ ] Animations (SOS pulse, ripple, status transitions)
- [ ] Error handling & loading states
- [ ] Mobile responsive design
- [ ] Test full SOS flow end-to-end
- [ ] Record demo / prepare presentation

---

## 🌐 Environment Variables

```env
# ──── Server ────
PORT=5000
NODE_ENV=development

# ──── MongoDB ────
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/safeher

# ──── JWT ────
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d

# ──── WhatsApp Business Cloud API ────
WHATSAPP_API_TOKEN=EAAxxxxxxx...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_API_URL=https://graph.facebook.com/v18.0

# ──── Twilio Voice ────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ──── Google Maps ────
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxx

# ──── Client ────
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxx
```

---

## 📦 Dependencies

### Frontend (`client/package.json`)
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "@react-google-maps/api": "^2.x",
    "axios": "^1.x",
    "socket.io-client": "^4.x",
    "react-icons": "^5.x",
    "react-hot-toast": "^2.x"
  }
}
```

### Backend (`server/package.json`)
```json
{
  "dependencies": {
    "express": "^4.x",
    "mongoose": "^8.x",
    "cors": "^2.x",
    "dotenv": "^16.x",
    "bcryptjs": "^2.x",
    "jsonwebtoken": "^9.x",
    "socket.io": "^4.x",
    "axios": "^1.x",
    "twilio": "^5.x",
    "uuid": "^9.x",
    "morgan": "^1.x"
  }
}
```

---

## ✅ Verification Plan

### Automated Tests
```bash
# Backend API test
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456","phone":"+911234567890"}'

# SOS trigger test
curl -X POST http://localhost:5000/api/sos/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"triggerType":"tap","lat":28.6139,"lng":77.2090}'
```

### Manual Verification
1. Register → Login → Add 2 emergency contacts
2. Tap SOS → Verify WhatsApp message received
3. Tap SOS → Verify Twilio voice call received
4. Open tracking link → Verify live location updates on map
5. Check Map View → Verify nearby police/hospitals shown
6. Test Shake-to-SOS → Verify SOS triggers on phone shake
7. Tap "I'm Safe" → Verify all-clear message sent
8. Test on mobile browser for responsive design

---

## ⏱️ Estimated Timeline

| Phase | Duration | Deliverable |
|---|---|---|
| Setup | ~2 hours | Working project skeleton |
| Backend Core | ~3 hours | All API endpoints working |
| Integrations | ~3 hours | WhatsApp + Twilio + Maps connected |
| Frontend Auth & Layout | ~2 hours | Login, register, navigation |
| Frontend Features | ~4 hours | SOS, Map, Contacts, Shake |
| Live Tracking | ~2 hours | Real-time Socket.IO tracking |
| Polish | ~2 hours | Animations, responsive, testing |
| **Total** | **~18 hours** | **Complete hackathon-ready app** |

---

> **Status: AWAITING APPROVAL** — Review this plan and say "start" to begin implementation! 🚀
