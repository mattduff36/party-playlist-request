# Notification System Usage Guide

## Overview
The notification system provides a centralized way to display errors, warnings, info messages, and debug information to admins.

## Features
- ✅ Error notifications (red)
- ✅ Warning notifications (amber)
- ✅ Info notifications (blue)
- ✅ Debug notifications (purple)
- ✅ Success notifications (green, auto-dismiss after 10s)
- ✅ Unread count badge
- ✅ Auto-mark as read when viewing
- ✅ Individual clear or clear all
- ✅ Persistent until manually cleared (except success)

## Usage in React Components

### Method 1: Using the Hook (Recommended)

```typescript
import { useNotificationHelpers } from '@/contexts/NotificationContext';

function MyComponent() {
  const { notifyError, notifyWarning, notifyInfo, notifyDebug, notifySuccess } = useNotificationHelpers();

  const handleError = () => {
    notifyError('API Error', 'Failed to fetch data from server');
  };

  const handleSuccess = () => {
    notifySuccess('Success', 'Data saved successfully!');
  };

  return (
    <button onClick={handleError}>Trigger Error</button>
  );
}
```

### Method 2: Using Global Functions (Anywhere)

```typescript
import { notifyError, notifyWarning, notifyInfo, notifyDebug, notifySuccess } from '@/lib/notifications';

// Can be used in any file, even non-React
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      notifyError('Fetch Failed', `Status: ${response.status}`);
    } else {
      notifySuccess('Data Loaded', 'Successfully fetched data');
    }
  } catch (error) {
    notifyError('Network Error', error.message);
  }
}
```

## Integration Examples

### In API Handlers (AdminDataContext)

```typescript
const handleApprove = async (id: string) => {
  try {
    const response = await fetch(`/api/admin/requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      notifyError('Approval Failed', 'Could not approve the request');
      return;
    }

    notifySuccess('Request Approved', 'Song has been added to queue');
  } catch (error) {
    notifyError('Network Error', 'Failed to connect to server');
  }
};
```

### In Error Boundaries

```typescript
import { notifyError } from '@/lib/notifications';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    notifyError('Application Error', error.message);
  }
}
```

### In Spotify Connection State

```typescript
import { notifyWarning, notifyError } from '@/lib/notifications';

export function recordSpotifyFailure(errorMessage: string): void {
  connectionState.failureCount++;
  
  if (connectionState.failureCount >= PERMANENT_FAILURE_THRESHOLD) {
    notifyWarning(
      'Spotify Disconnected', 
      'Manual reconnection required. Too many failed attempts.'
    );
  } else {
    // Don't spam for every failure, only notify on first
    if (connectionState.failureCount === 1) {
      notifyError('Spotify Connection Issue', errorMessage);
    }
  }
}
```

### Debug Messages (Development)

```typescript
import { notifyDebug } from '@/lib/notifications';

// Only show in development
if (process.env.NODE_ENV === 'development') {
  notifyDebug('State Update', `Queue length: ${queue.length}`);
}
```

## Notification Types

### Error (Red)
Use for: API failures, network errors, critical issues
```typescript
notifyError('Error Title', 'Detailed error message');
```

### Warning (Amber)
Use for: Non-critical issues, deprecated features, manual actions needed
```typescript
notifyWarning('Warning Title', 'Something needs attention');
```

### Info (Blue)
Use for: General information, status updates
```typescript
notifyInfo('Info Title', 'FYI: Something happened');
```

### Debug (Purple)
Use for: Development debugging, state changes, diagnostic info
```typescript
notifyDebug('Debug Title', 'Variable value: ' + value);
```

### Success (Green)
Use for: Successful operations (auto-dismisses after 10s)
```typescript
notifySuccess('Success Title', 'Operation completed successfully');
```

## Best Practices

### DO:
✅ Use descriptive titles (2-4 words)
✅ Provide actionable error messages
✅ Include relevant details in the message
✅ Use appropriate severity levels
✅ Clear stale notifications when issue resolved

### DON'T:
❌ Spam notifications for the same repeated error
❌ Use success notifications for trivial actions
❌ Put long stack traces in notifications (log those instead)
❌ Create notifications for expected states (like "loading...")
❌ Use debug notifications in production builds

## Example: Smart Error Handling

```typescript
let lastErrorTime = 0;
const ERROR_THROTTLE_MS = 5000; // Only notify once per 5 seconds

async function fetchWithErrorHandling(url: string) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      // Throttle errors to prevent spam
      const now = Date.now();
      if (now - lastErrorTime > ERROR_THROTTLE_MS) {
        notifyError('API Error', `${response.status}: ${response.statusText}`);
        lastErrorTime = now;
      }
      return null;
    }
    
    return await response.json();
  } catch (error) {
    // Network errors are always important
    notifyError('Network Error', 'Cannot reach server');
    throw error;
  }
}
```

## Accessing Notification Context Directly

For advanced use cases:

```typescript
import { useNotifications } from '@/contexts/NotificationContext';

function AdvancedComponent() {
  const { notifications, unreadCount, clearNotification, clearAll, markAsRead } = useNotifications();

  // Access all notifications
  const errorNotifications = notifications.filter(n => n.type === 'error');

  // Manually clear specific notification
  const handleClearOldest = () => {
    if (notifications.length > 0) {
      clearNotification(notifications[notifications.length - 1].id);
    }
  };

  return (
    <div>
      <p>Unread: {unreadCount}</p>
      <button onClick={clearAll}>Clear All</button>
    </div>
  );
}
```

## Notification Object Structure

```typescript
interface Notification {
  id: string;              // Unique identifier
  type: NotificationType;  // 'error' | 'warning' | 'info' | 'debug' | 'success'
  title: string;           // Short title
  message: string;         // Detailed message
  timestamp: Date;         // When created
  read: boolean;           // Whether user has seen it
}
```

## Testing Notifications

Create a test button in development:

```typescript
// In a dev-only component
function NotificationTester() {
  const { notifyError, notifyWarning, notifyInfo, notifyDebug, notifySuccess } = useNotificationHelpers();

  return (
    <div className="p-4 space-x-2">
      <button onClick={() => notifyError('Test Error', 'This is a test error')}>
        Test Error
      </button>
      <button onClick={() => notifyWarning('Test Warning', 'This is a test warning')}>
        Test Warning
      </button>
      <button onClick={() => notifyInfo('Test Info', 'This is a test info')}>
        Test Info
      </button>
      <button onClick={() => notifyDebug('Test Debug', 'This is a test debug')}>
        Test Debug
      </button>
      <button onClick={() => notifySuccess('Test Success', 'This is a test success')}>
        Test Success
      </button>
    </div>
  );
}
```

## Implementation Files

- **Context**: `src/contexts/NotificationContext.tsx`
- **Dropdown UI**: `src/components/admin/NotificationsDropdown.tsx`
- **Global Helpers**: `src/lib/notifications.ts`
- **Initializer**: `src/components/admin/NotificationInitializer.tsx`
- **Provider**: `src/app/admin/layout.tsx`

## Future Enhancements

Potential additions:
- Notification persistence (localStorage)
- Notification categories/filtering
- Sound effects on critical errors
- Toast-style temporary notifications
- Notification history page
- Export notifications for debugging

