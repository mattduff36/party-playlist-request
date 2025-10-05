/**
 * Notification Utilities
 * 
 * Helper functions for triggering notifications throughout the app
 */

// Note: These functions work by directly calling the notification context
// They should be used within components that have access to the NotificationProvider

// For use outside of React components (like in API handlers), 
// you can store a reference to the notification functions

let globalNotificationHandler: {
  error: (title: string, message: string) => void;
  warning: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
  debug: (title: string, message: string) => void;
  success: (title: string, message: string) => void;
} | null = null;

export function setGlobalNotificationHandler(handler: typeof globalNotificationHandler) {
  globalNotificationHandler = handler;
}

export function notifyError(title: string, message: string) {
  if (globalNotificationHandler) {
    globalNotificationHandler.error(title, message);
  } else {
    console.error('[Notification]', title, message);
  }
}

export function notifyWarning(title: string, message: string) {
  if (globalNotificationHandler) {
    globalNotificationHandler.warning(title, message);
  } else {
    console.warn('[Notification]', title, message);
  }
}

export function notifyInfo(title: string, message: string) {
  if (globalNotificationHandler) {
    globalNotificationHandler.info(title, message);
  } else {
    console.info('[Notification]', title, message);
  }
}

export function notifyDebug(title: string, message: string) {
  if (globalNotificationHandler) {
    globalNotificationHandler.debug(title, message);
  } else {
    console.log('[Notification]', title, message);
  }
}

export function notifySuccess(title: string, message: string) {
  if (globalNotificationHandler) {
    globalNotificationHandler.success(title, message);
  } else {
    console.log('[Notification]', title, message);
  }
}

