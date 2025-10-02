# Product Requirements Document: Admin Simplified Page Functionality Fixes

## Introduction/Overview

The current `/admin/simplified` page has several critical functionality issues that prevent it from being a fully functional admin interface. This feature addresses the broken Event Control buttons, Page Controls integration, missing Song Requests functionality, and overall system integration. The goal is to create a comprehensive, working admin interface that can replace the current `/admin/overview` page and provide all necessary party playlist management functionality.

## Goals

1. **Fix Event Control State Management**: Implement proper state transitions and page behavior for Offline/Standby/Live states
2. **Resolve Page Controls Integration**: Ensure Page Controls work independently and only when Event Control is in Standby or Live state
3. **Integrate Complete Song Requests Management**: Copy full Song Requests functionality from `/admin/requests` to the simplified page
4. **Replace Admin Overview Page**: Delete current `/admin/overview` and rename `/admin/simplified` to `/admin/overview`
5. **Comprehensive System Testing**: Ensure all admin functionality works end-to-end without errors
6. **Maintain Cross-Platform Synchronization**: Ensure all changes work across devices and networks via Pusher

## User Stories

### Event Control Management
- **As an admin**, I want to set the event to "Offline" so that both home and display pages show "Party Not Started" and cannot be enabled
- **As an admin**, I want to set the event to "Standby" so that I can enable/disable pages in preparation for the event
- **As an admin**, I want to set the event to "Live" so that the event is in progress and pages can be controlled independently
- **As an admin**, I want the Event Control state to persist across page refreshes and sync across all admin devices

### Page Controls Integration
- **As an admin**, I want to enable/disable the Requests page independently of the Display page
- **As an admin**, I want Page Controls to only be available when Event Control is in Standby or Live state
- **As an admin**, I want Page Controls to work independently without affecting each other
- **As an admin**, I want Page Control changes to immediately reflect on the public pages

### Song Requests Management
- **As an admin**, I want to view all song requests in a comprehensive list with filtering options
- **As an admin**, I want to approve, reject, or delete individual song requests
- **As an admin**, I want to perform batch actions on multiple selected requests
- **As an admin**, I want to see real-time updates when new requests are submitted
- **As an admin**, I want to manage requests without needing to navigate to a separate page

### System Integration
- **As an admin**, I want all admin functionality consolidated into a single, intuitive interface
- **As an admin**, I want the admin interface to work seamlessly across all devices
- **As an admin**, I want all changes to be synchronized in real-time across all connected devices

## Functional Requirements

### 1. Event Control State Management
1.1. The system must implement three distinct event states: Offline, Standby, and Live
1.2. When in "Offline" state, both home and display pages must show "Party Not Started" screen
1.3. When in "Offline" state, Page Controls must be disabled and non-functional
1.4. When in "Standby" or "Live" state, Page Controls must be enabled and functional
1.5. Event Control state changes must be persisted and synchronized across all devices
1.6. Event Control buttons must provide visual feedback for the current state
1.7. State transitions must be smooth and provide user feedback

### 2. Page Controls Integration
2.1. Page Controls must only be functional when Event Control is in "Standby" or "Live" state
2.2. Requests Page and Display Page controls must work independently
2.3. Enabling one page must not disable the other page
2.4. Page Control changes must immediately affect the corresponding public pages
2.5. Page Control state must be synchronized across all admin devices
2.6. Page Controls must provide clear visual indication of enabled/disabled state

### 3. Song Requests Management Integration
3.1. The system must copy the complete Song Requests section from `/admin/requests` page
3.2. The Song Requests section must include all functionality: view, approve, reject, delete
3.3. The system must support batch operations on multiple selected requests
3.4. The Song Requests section must include filtering by status (all, pending, approved, rejected)
3.5. The Song Requests section must include search functionality
3.6. The Song Requests section must display real-time updates via Pusher
3.7. The Song Requests section must be positioned above the Spotify Status section

### 4. Page Structure and Navigation
4.1. The system must delete the current `/admin/overview` page
4.2. The system must rename `/admin/simplified` to `/admin/overview`
4.3. The system must update all navigation links to point to the new `/admin/overview`
4.4. The system must maintain all existing admin functionality in the new structure
4.5. The system must preserve the tabbed interface (Overview, Requests, Spotify, Settings)

### 5. Real-time Synchronization
5.1. All Event Control state changes must be broadcast via Pusher
5.2. All Page Control changes must be broadcast via Pusher
5.3. All Song Request actions must be broadcast via Pusher
5.4. The system must handle Pusher connection failures gracefully
5.5. The system must provide offline functionality with sync when reconnected

### 6. Error Handling and Validation
6.1. The system must validate Event Control state transitions
6.2. The system must handle API errors gracefully with user feedback
6.3. The system must prevent invalid Page Control operations
6.4. The system must provide clear error messages for failed operations
6.5. The system must maintain data consistency across all operations

## Non-Goals (Out of Scope)

1. **New Features**: This is a fix/improvement project, not a feature addition project
2. **UI/UX Redesign**: Focus on functionality fixes, not visual design changes
3. **Mobile Optimization**: Current responsive design is sufficient
4. **New Admin Users**: Focus on existing admin functionality
5. **Spotify Integration Changes**: Spotify functionality remains as-is
6. **Settings Page Modifications**: Settings tab functionality review is deferred

## Design Considerations

- **Consistency**: Maintain the existing design language and component structure
- **Accessibility**: Ensure all interactive elements are accessible
- **Responsive**: Maintain responsive design across all device sizes
- **Performance**: Ensure real-time updates don't impact page performance
- **User Experience**: Provide clear visual feedback for all user actions

## Technical Considerations

- **State Management**: Use existing GlobalEventProvider for state management
- **API Integration**: Ensure all API calls include proper authentication tokens
- **Pusher Integration**: Maintain existing Pusher event structure
- **Database**: Use existing database schema and operations
- **Authentication**: Maintain existing admin authentication system
- **Error Boundaries**: Implement proper error handling for all components

## Success Metrics

1. **Functionality**: All buttons and controls work as expected (100% functional)
2. **Error Rate**: Zero console errors during normal operation
3. **Performance**: Page loads and responds within 2 seconds
4. **Synchronization**: Real-time updates work across all connected devices
5. **User Experience**: Smooth, intuitive operation without confusion
6. **Test Coverage**: All admin functionality passes comprehensive testing

## Open Questions

1. **Event State Persistence**: Should Event Control state persist across server restarts?
2. **Page Control Defaults**: What should be the default state of Page Controls when switching to Standby/Live?
3. **Request Management**: Should the Song Requests section have the same layout as the original admin/requests page?
4. **Navigation**: Should there be any changes to the admin navigation structure?
5. **Backup**: Should we create a backup of the current admin/overview page before deletion?

## Implementation Priority

1. **High Priority**: Fix Event Control and Page Controls functionality
2. **High Priority**: Integrate Song Requests management
3. **Medium Priority**: Page structure changes (rename/delete)
4. **Medium Priority**: Comprehensive testing and validation
5. **Low Priority**: Performance optimization and error handling improvements

## Dependencies

- Existing GlobalEventProvider state management system
- Existing Pusher real-time synchronization
- Existing admin authentication system
- Existing database schema and API endpoints
- Existing admin component library

---

**Document Version**: 1.0  
**Created**: December 2024  
**Status**: Ready for Implementation  
**Estimated Effort**: 2-3 days development + 1 day testing
