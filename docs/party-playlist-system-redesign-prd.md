# Party Playlist Request System - Complete Redesign PRD

## 🎯 **Project Overview**

**Project Name**: Party Playlist Request System - Architecture Redesign  
**Version**: 2.0  
**Date**: December 2024  
**Status**: Planning Phase  

### **Executive Summary**
Complete architectural redesign of the Party Playlist Request System to eliminate complexity, improve maintainability, and ensure perfect cross-platform functionality. The current system has grown organically and accumulated significant technical debt, resulting in 80%+ unnecessary code complexity and fragile cross-device synchronization.

### **Business Objectives**
- **Reduce Development Time**: 80% reduction in code complexity for faster feature development
- **Improve Reliability**: Eliminate cross-device synchronization issues and state management bugs
- **Enhance User Experience**: Consistent behavior across all devices and networks
- **Lower Maintenance Cost**: Simplified architecture reduces debugging time and support burden
- **Enable Scaling**: Support 350+ concurrent users with sub-100ms real-time updates

## 🎯 **Core Requirements**

### **Fundamental Workflow States**
The system operates in three distinct states that control all page behavior:

1. **State 0 (Offline)**: No admin logged in
   - All pages show "Party Not Started" screen
   - No functionality available

2. **State 1 (Standby)**: Admin logged in, pages disabled
   - Admin panel fully functional
   - Home page shows "Disabled" screen
   - Display page shows "Disabled" screen

3. **State 2 (Live)**: Admin logged in, pages enabled
   - All pages fully functional
   - Real-time synchronization active
   - Full Spotify integration operational

### **Cross-Platform Requirements**
- **Device Independence**: Home and Display pages work identically on any device/network
- **No Device-Based Logic**: Pages determine behavior from global state, not local device state
- **Network Resilience**: Pages sync across different networks via Pusher
- **Consistent UX**: Identical behavior regardless of access method

### **Core User Flows**

#### **Admin Flow**
1. Admin visits `/admin` and logs in → System enters State 1
2. Admin enables Request and Display pages → System enters State 2
3. Admin connects Spotify account for playback control
4. Admin manages song requests (approve/reject)
5. Admin controls party state (live/standby/offline)

#### **Guest Flow**
1. Guest visits home page
2. If State 0: Shows "Party Not Started"
3. If State 1: Shows "Requests Disabled"
4. If State 2: Shows request form, can submit songs

#### **Display Flow**
1. Display page loads on TV/tablet/mobile
2. If State 0: Shows "Party Not Started"
3. If State 1: Shows "Display Disabled"
4. If State 2: Shows current track, queue, and real-time updates

## 🚨 **Current Problems**

### **Critical Issues**
1. **Dual Authentication Logic**: 75+ lines of complex auth logic repeated in every component
2. **Device-Based Admin Detection**: Home/Display pages check localStorage for admin tokens
3. **Fragmented State Management**: 4 different state systems (React, localStorage, database, Pusher)
4. **Over-Engineered Page Controls**: Complex enable/disable logic with race conditions
5. **API Route Proliferation**: 40+ endpoints when 8 would suffice
6. **Database Over-Normalization**: 7 tables for simple CRUD operations

### **Complexity Metrics**
- **HomePage**: 770 lines (should be ~150)
- **DisplayPage**: 1340 lines (should be ~200)
- **API Routes**: 40+ endpoints (should be 8)
- **Database Tables**: 7 tables (should be 4)
- **Authentication Logic**: Duplicated across 5+ components

## 🏗️ **Proposed Solution**

### **Global Event State Machine**
Replace device-based logic with centralized event state:

```typescript
interface GlobalEventState {
  id: string;
  status: 'offline' | 'standby' | 'live';
  version: number;
  active_admin_id: string | null;
  device_id: string | null;
  pages_enabled: {
    requests: boolean;
    display: boolean;
  };
  updated_at: string;
}
```

### **Simplified Database Schema**
Consolidate 7 tables into 4 focused tables:

```sql
-- Core event state
events (id, status, version, active_admin_id, device_id, config, updated_at)

-- Admin management  
admins (id, email, password_hash, name, created_at)

-- Spotify integration
spotify_tokens (admin_id, access_token, refresh_token, expires_at, scope)

-- Song requests
requests (id, event_id, track_id, track_data, submitted_by, status, timestamps)
```

### **Unified Real-time Architecture**
Single Pusher channel with action-based events:

```typescript
// One channel per event
const CHANNEL = `event.${eventId}`;

// Action-based event system
interface PusherEvent {
  action: 'STATE_CHANGED' | 'REQUEST_SUBMITTED' | 'REQUEST_APPROVED' | 'NOWPLAYING_UPDATED';
  data: any;
  timestamp: number;
}
```

### **Simplified Page Logic**
Remove all device-based authentication:

```typescript
// Home Page - No admin detection needed
const HomePage = () => {
  const { eventState } = useGlobalEvent();
  
  if (eventState.status === 'offline') return <PartyNotStarted />;
  if (eventState.status === 'standby') return <PagesDisabled />;
  if (!eventState.pages_enabled.requests) return <RequestsDisabled />;
  
  return <RequestForm />;
};
```

## 📋 **Detailed Requirements**

### **Functional Requirements**

#### **FR1: Global State Management**
- **FR1.1**: Single source of truth for all application state
- **FR1.2**: Optimistic updates with version control to prevent conflicts
- **FR1.3**: Automatic state synchronization across all connected devices
- **FR1.4**: State transitions: offline ↔ standby ↔ live (enforced server-side)

#### **FR2: Cross-Platform Compatibility**
- **FR2.1**: Home page works identically on any device/network
- **FR2.2**: Display page works identically on any device/network
- **FR2.3**: No device-specific admin detection on public pages
- **FR2.4**: Consistent behavior regardless of access method

#### **FR3: Real-time Synchronization**
- **FR3.1**: Sub-100ms update propagation across all devices
- **FR3.2**: Reliable delivery of state changes via Pusher
- **FR3.3**: Graceful handling of network interruptions
- **FR3.4**: Automatic reconnection and state recovery

#### **FR4: Admin Interface**
- **FR4.1**: Three-button interface for state control (offline/standby/live)
- **FR4.2**: Simple page enable/disable toggles
- **FR4.3**: Spotify account connection and device selection
- **FR4.4**: Request management (approve/reject) with immediate feedback

#### **FR5: Performance**
- **FR5.1**: Support 350+ concurrent requests
- **FR5.2**: <2s initial page load on all devices
- **FR5.3**: <100ms real-time update propagation
- **FR5.4**: 99.9% uptime during events

### **Technical Requirements**

#### **TR1: Architecture**
- **TR1.1**: Edge functions for high-traffic public endpoints
- **TR1.2**: Node.js functions for Spotify API integration
- **TR1.3**: Drizzle ORM with Neon HTTP driver for Edge safety
- **TR1.4**: Upstash Redis for rate limiting and caching

#### **TR2: Database**
- **TR2.1**: PostgreSQL with connection pooling
- **TR2.2**: Optimistic locking with version control
- **TR2.3**: Proper indexing for performance
- **TR2.4**: Encrypted storage for sensitive data

#### **TR3: Security**
- **TR3.1**: Auth.js v5 for admin authentication
- **TR3.2**: HttpOnly, SameSite=Lax session cookies
- **TR3.3**: CSRF protection on admin endpoints
- **TR3.4**: Rate limiting with sliding window algorithm

#### **TR4: Real-time**
- **TR4.1**: Pusher with per-event namespaces
- **TR4.2**: Action-based event system
- **TR4.3**: Automatic reconnection logic
- **TR4.4**: Event deduplication and ordering

## 🎨 **User Experience Design**

### **Admin Experience**
- **Simple State Control**: One toggle for party status (offline/standby/live)
- **Page Management**: Clear enable/disable toggles for requests and display
- **Spotify Integration**: One-click connection with device selection
- **Request Management**: Streamlined approve/reject with immediate feedback

### **Guest Experience**
- **Clear Status Communication**: Always know if party is active
- **Consistent Interface**: Same experience regardless of device
- **Real-time Feedback**: Immediate confirmation of request submission
- **Mobile Optimized**: Touch-friendly interface for all devices

### **Display Experience**
- **Responsive Design**: Works on TV, tablet, and mobile
- **Real-time Updates**: Live queue and current track display
- **Visual Feedback**: Animations for new requests and approvals
- **Status Indicators**: Clear connection and Spotify status

## 🚀 **Implementation Plan**

### **Phase 1: Foundation (Week 1)**
- [ ] Create new database schema with migration
- [ ] Implement global event state API
- [ ] Create `useGlobalEvent` hook
- [ ] Set up single Pusher channel architecture

### **Phase 2: Remove Complexity (Week 2)**
- [ ] Remove all localStorage admin detection from Home/Display
- [ ] Implement simple state-based page rendering
- [ ] Consolidate authentication to admin pages only
- [ ] Remove duplicate loading states and useEffect chains

### **Phase 3: Real-time Simplification (Week 3)**
- [ ] Centralize all Pusher event handling
- [ ] Implement action-based event system
- [ ] Remove scattered event listeners
- [ ] Test cross-device synchronization

### **Phase 4: Admin UX (Week 4)**
- [ ] Implement three-button admin interface
- [ ] Add automatic state transitions
- [ ] Implement optimistic updates with version control
- [ ] Add proper error handling and rollback

### **Phase 5: Performance & Polish (Week 5)**
- [ ] Implement edge caching for event state
- [ ] Add rate limiting with Upstash Redis
- [ ] Optimize bundle size and loading
- [ ] Add comprehensive error boundaries

## 📊 **Success Metrics**

### **Code Quality Metrics**
- **Code Reduction**: 80%+ reduction in main components
- **Complexity Score**: 60%+ reduction in cyclomatic complexity
- **Bundle Size**: 30%+ reduction in JavaScript bundle
- **API Surface**: 80%+ reduction in endpoint count

### **Performance Metrics**
- **Load Time**: <2s initial page load
- **Update Latency**: <100ms real-time propagation
- **Throughput**: Support 350+ concurrent requests
- **Uptime**: 99.9% availability during events

### **User Experience Metrics**
- **Cross-Device Sync**: 100% consistency across devices
- **Error Rate**: <0.1% authentication-related errors
- **User Satisfaction**: Improved admin and guest experience
- **Support Tickets**: 80%+ reduction in complexity-related issues

## 🔧 **Technical Specifications**

### **Technology Stack**
- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes, Edge Runtime
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **Real-time**: Pusher
- **Caching**: Upstash Redis
- **Authentication**: Auth.js v5
- **Deployment**: Vercel

### **API Endpoints**
```
GET    /api/event/:id              # Get event state
POST   /api/event/:id/status       # Update event status (admin)
POST   /api/event/:id/pages        # Toggle page enablement (admin)
POST   /api/requests               # Submit song request
PATCH  /api/requests/:id           # Approve/reject request (admin)
POST   /api/spotify/enqueue        # Add to Spotify queue (admin)
GET    /api/spotify/status         # Get Spotify connection status
POST   /api/auth/login             # Admin login
POST   /api/auth/logout            # Admin logout
```

### **Database Schema**
```sql
-- Events table (core state)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text CHECK (status IN ('offline','standby','live')) NOT NULL DEFAULT 'offline',
  version integer NOT NULL DEFAULT 0,
  active_admin_id uuid REFERENCES admins(id),
  device_id text,
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Admins table
CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

-- Spotify tokens table
CREATE TABLE spotify_tokens (
  admin_id uuid PRIMARY KEY REFERENCES admins(id),
  access_token text,
  refresh_token text, -- encrypted
  expires_at timestamptz,
  scope text
);

-- Requests table
CREATE TABLE requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) NOT NULL,
  track_id text NOT NULL,
  track_data jsonb NOT NULL,
  submitted_by text,
  status text CHECK (status IN ('pending','approved','rejected','played')) DEFAULT 'pending',
  idempotency_key text,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  UNIQUE(event_id, idempotency_key)
);
```

## 🚨 **Risk Assessment**

### **High Risk**
- **Data Migration**: Complex migration from 7-table to 4-table schema
- **Real-time Sync**: Ensuring perfect cross-device synchronization
- **State Consistency**: Preventing race conditions in state updates

### **Medium Risk**
- **Performance**: Meeting 350+ concurrent user requirement
- **Backward Compatibility**: Maintaining existing functionality during transition
- **User Training**: Admin interface changes may require documentation

### **Low Risk**
- **Code Quality**: Significant improvement expected
- **Maintenance**: Reduced complexity will lower maintenance burden
- **Scalability**: New architecture designed for better scaling

## 📋 **Acceptance Criteria**

### **Must Have**
- [ ] All three states (offline/standby/live) work correctly
- [ ] Cross-device synchronization is perfect
- [ ] No device-based admin detection on public pages
- [ ] 80%+ code reduction in main components
- [ ] All existing functionality preserved

### **Should Have**
- [ ] Sub-100ms real-time update propagation
- [ ] Support for 350+ concurrent users
- [ ] <2s initial page load time
- [ ] Comprehensive error handling

### **Could Have**
- [ ] Advanced analytics dashboard
- [ ] Multi-event support
- [ ] Advanced Spotify features
- [ ] Mobile app companion

## 📅 **Timeline**

**Total Duration**: 5 weeks  
**Team Size**: 1-2 developers  
**Deployment**: Zero-downtime migration  

### **Milestones**
- **Week 1**: Foundation complete
- **Week 2**: Complexity removed
- **Week 3**: Real-time simplified
- **Week 4**: Admin UX complete
- **Week 5**: Performance optimized

## 🎯 **Conclusion**

This redesign transforms the Party Playlist Request System from a complex, device-dependent architecture to a simple, state-driven system that perfectly matches the core workflow requirements. The 80%+ code reduction, improved reliability, and enhanced cross-platform functionality will provide significant business value while dramatically reducing maintenance overhead.

The phased implementation approach ensures zero disruption to current users while delivering immediate benefits as each phase completes. The new architecture is designed to scale efficiently and provide a solid foundation for future enhancements.
