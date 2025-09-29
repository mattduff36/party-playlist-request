# Party Playlist Request System - Complete Redesign PRD

## 1. Introduction/Overview

The Party Playlist Request System requires a complete architectural redesign to eliminate 80%+ of current code complexity while maintaining all existing functionality. The current system has grown organically and accumulated significant technical debt, resulting in fragile cross-device synchronization, over-engineered state management, and maintenance challenges.

**Problem**: The current system uses device-based authentication logic that creates complexity and inconsistency across devices. Home and Display pages check localStorage for admin tokens, leading to race conditions and unreliable cross-device synchronization.

**Goal**: Transform the system into a simple, state-driven architecture with perfect cross-device synchronization, 80%+ code reduction, and comprehensive functionality preservation.

## 2. Goals

- **Eliminate Complexity**: Reduce codebase by 80%+ through architectural simplification
- **Perfect Cross-Device Sync**: Ensure identical behavior across all devices and networks
- **Maintain All Features**: Preserve every existing feature while simplifying implementation
- **Improve Performance**: Support 350+ concurrent users with <500ms real-time updates
- **Enhance Reliability**: Implement automatic recovery and admin notification systems
- **Simplify Maintenance**: Create maintainable, debuggable codebase for future development

## 3. User Stories

### Admin Stories
- **As an admin**, I want a simple three-button interface to control party state (offline/standby/live) so that I can easily manage the party without confusion
- **As an admin**, I want to enable/disable pages with simple toggles so that I have granular control over what guests can access
- **As an admin**, I want to connect my Spotify account once and have it work reliably so that I don't have to troubleshoot connection issues
- **As an admin**, I want to approve/reject requests with immediate feedback so that I can manage the queue efficiently
- **As an admin**, I want to be notified when system errors occur so that I can address issues quickly

### Guest Stories
- **As a guest**, I want the request page to work identically on any device so that I can submit requests from my phone, tablet, or computer
- **As a guest**, I want clear status messages (Party Not Started/Disabled/Active) so that I understand when I can make requests
- **As a guest**, I want immediate confirmation when I submit a request so that I know it was received
- **As a guest**, I want to see real-time updates when my request is approved so that I know it's in the queue

### Display Stories
- **As a display operator**, I want the display to work on any device (TV/tablet/mobile) so that I can use whatever hardware is available
- **As a display operator**, I want real-time updates of the current track and queue so that guests can see what's playing
- **As a display operator**, I want visual feedback when new requests are approved so that the display feels alive and responsive

## 4. Functional Requirements

### Core State Management
1. **FR1**: The system must maintain a single global event state that controls all page behavior
2. **FR2**: The system must support three states: offline (no admin), standby (admin logged in, pages disabled), live (admin logged in, pages enabled)
3. **FR3**: The system must synchronize state changes across all connected devices within 500ms
4. **FR4**: The system must use optimistic updates with version control to prevent conflicts
5. **FR5**: The system must automatically recover from network interruptions and state inconsistencies

### Cross-Platform Compatibility
6. **FR6**: Home and Display pages must work identically on any device without device-specific logic
7. **FR7**: The system must not check localStorage or device-specific admin tokens on public pages
8. **FR8**: The system must maintain consistent behavior regardless of network or access method
9. **FR9**: The system must support simultaneous access from multiple devices and networks

### Admin Interface
10. **FR10**: The admin interface must provide a simple three-button control for party state (offline/standby/live)
11. **FR11**: The admin interface must include page enable/disable toggles for requests and display pages
12. **FR12**: The admin interface must support Spotify account connection and device selection
13. **FR13**: The admin interface must provide request management (approve/reject) with immediate visual feedback
14. **FR14**: The admin interface must show current Spotify connection status and any errors
15. **FR15**: The admin interface must include all current functionality but with simplified UX

### Real-time Synchronization
16. **FR16**: The system must use a single Pusher channel per event with action-based event system
17. **FR17**: The system must propagate state changes to all connected devices within 500ms
18. **FR18**: The system must handle automatic reconnection and state recovery
19. **FR19**: The system must prevent duplicate events and maintain proper event ordering
20. **FR20**: The system must gracefully handle Pusher connection failures with fallback mechanisms

### Performance and Reliability
21. **FR21**: The system must support 350+ concurrent users without degradation
22. **FR22**: The system must maintain <2s initial page load times on all devices
23. **FR23**: The system must implement comprehensive error handling with automatic recovery
24. **FR24**: The system must provide admin notifications for critical errors
25. **FR25**: The system must include extensive testing suite covering all functionality

### Data Management
26. **FR26**: The system must use a simplified 4-table database schema (events, admins, spotify_tokens, requests)
27. **FR27**: The system must implement proper data encryption for sensitive information
28. **FR28**: The system must support zero-downtime database migrations
29. **FR29**: The system must maintain data integrity with proper constraints and validation
30. **FR30**: The system must implement efficient indexing for performance

## 5. Non-Goals (Out of Scope)

- **Multi-event Support**: This redesign focuses on single-event functionality
- **Advanced Analytics**: Complex reporting and analytics features
- **Mobile App**: Native mobile applications
- **Advanced Spotify Features**: Complex playlist management beyond basic queue control
- **User Accounts**: Guest user registration or profiles
- **Payment Integration**: Any monetization features
- **Social Features**: User interactions, comments, or social sharing
- **Advanced Admin Features**: Complex role management or multi-admin workflows

## 6. Design Considerations

### User Interface
- **Admin Interface**: Clean, minimal design with three primary state buttons and clear visual hierarchy
- **Guest Interface**: Consistent design across all devices with clear status communication
- **Display Interface**: Responsive design that works on TV (large), tablet (medium), and mobile (small) screens
- **Status Indicators**: Clear visual feedback for connection status, Spotify status, and system health

### User Experience
- **Progressive Disclosure**: Show only relevant controls based on current state
- **Immediate Feedback**: All actions provide instant visual confirmation
- **Error Prevention**: Clear validation and helpful error messages
- **Accessibility**: Support for screen readers and keyboard navigation

### Visual Design
- **Consistent Branding**: Maintain current visual identity and color scheme
- **Responsive Layout**: Adapt to different screen sizes and orientations
- **Loading States**: Clear loading indicators during state transitions
- **Animation**: Subtle animations for state changes and real-time updates

## 7. Technical Considerations

### Architecture
- **Edge Functions**: Use Vercel Edge Runtime for high-traffic public endpoints
- **Node.js Functions**: Use Node.js runtime for Spotify API integration and admin operations
- **Database**: PostgreSQL with Drizzle ORM and Neon HTTP driver for Edge safety
- **Caching**: Upstash Redis for rate limiting and performance optimization

### Security
- **Authentication**: Auth.js v5 with HttpOnly, SameSite=Lax session cookies
- **CSRF Protection**: Built-in CSRF protection on all admin endpoints
- **Rate Limiting**: Sliding window algorithm with Upstash Redis
- **Data Encryption**: Encrypt sensitive data at rest using libsodium

### Performance
- **Connection Pooling**: Use Neon pooled connections for database operations
- **Edge Caching**: Implement Vercel KV caching for frequently accessed data
- **Bundle Optimization**: Reduce JavaScript bundle size by 30%+
- **Real-time Optimization**: Efficient Pusher event handling with deduplication

### Dependencies
- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes, Edge Runtime
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **Real-time**: Pusher
- **Caching**: Upstash Redis
- **Authentication**: Auth.js v5
- **Deployment**: Vercel

## 8. Success Metrics

### Code Quality Metrics
- **Code Reduction**: 80%+ reduction in main components (HomePage: 770→150 lines, DisplayPage: 1340→200 lines)
- **API Simplification**: 80%+ reduction in endpoint count (40+ → 8 endpoints)
- **Database Simplification**: 43%+ reduction in table count (7 → 4 tables)
- **Complexity Score**: 60%+ reduction in cyclomatic complexity

### Performance Metrics
- **Load Time**: <2s initial page load on all devices
- **Real-time Latency**: <500ms update propagation across devices
- **Throughput**: Support 350+ concurrent users without degradation
- **Uptime**: 99.9% availability during events

### User Experience Metrics
- **Cross-Device Consistency**: 100% identical behavior across all devices
- **Error Rate**: <0.1% authentication-related errors
- **Admin Efficiency**: 50%+ reduction in admin task completion time
- **Support Tickets**: 80%+ reduction in complexity-related support requests

### Business Metrics
- **Development Velocity**: 50%+ faster feature development
- **Maintenance Cost**: 70%+ reduction in debugging and support time
- **User Satisfaction**: Improved admin and guest experience scores
- **System Reliability**: 90%+ reduction in cross-device sync issues

## 9. Open Questions

1. **Migration Timeline**: What is the preferred timeline for the big bang migration? Should it be done during low-usage periods?

2. **Testing Environment**: Do you have a staging environment set up for extensive testing before production deployment?

3. **Backup Strategy**: What backup and rollback procedures should be in place for the migration?

4. **User Communication**: How should existing users be notified about the migration and any changes to the interface?

5. **Performance Monitoring**: What monitoring and alerting systems should be implemented to track the success metrics?

6. **Documentation**: What level of documentation is needed for the new system (admin guides, API docs, developer docs)?

7. **Future Enhancements**: Are there any planned future features that should influence the new architecture design?

8. **Third-party Integrations**: Are there any external systems that currently integrate with the API that need to be updated?

---

**Target Audience**: This PRD is designed for junior developers to understand and implement the complete system redesign. All requirements are explicit and unambiguous, with clear success criteria and technical specifications.

**Implementation Approach**: Big bang migration with extensive testing, clean slate compatibility, and comprehensive functionality preservation while achieving 80%+ code simplification.
