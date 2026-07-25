/**
 * Notifications Dropdown Component
 * 
 * Compact notification icon with dropdown showing errors and debug messages
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Bell,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useNotifications, type NotificationType } from '@/contexts/NotificationContext';

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Mark all as read when opening
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      // Mark as read after a short delay
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, unreadCount, markAllAsRead]);

  // Format time ago
  const timeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Get icon for notification type
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-accent" />;
      case 'debug':
        return <Bug className="w-5 h-5 text-accent" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-accent" />;
      default:
        return <Bell className="w-5 h-5 text-muted" />;
    }
  };

  // Get background color for notification type
  const getNotificationBgColor = (type: NotificationType) => {
    switch (type) {
      case 'error':
        return 'bg-red-900/20 border-red-700/30';
      case 'warning':
        return 'bg-amber-900/20 border-amber-700/30';
      case 'info':
        return 'bg-accent/10 border-accent/30';
      case 'debug':
        return 'bg-accent/10 border-accent/30';
      case 'success':
        return 'bg-accent/10 border-accent/30';
      default:
        return 'bg-surface/30 border-white/10';
    }
  };

  // Handle clear all
  const handleClearAll = () => {
    if (confirm(`Are you sure you want to clear all ${notifications.length} notifications?`)) {
      clearAll();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-surface rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-muted" />
        
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-bone text-xs rounded-full min-w-[1rem] h-4 flex items-center justify-center px-1 font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-elevated rounded-lg shadow-xl border border-white/10 z-50 max-h-[32rem] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-bone font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
                {notifications.length > 0 && (
                  <span className="text-xs bg-surface text-bone px-2 py-0.5 rounded-full">
                    {notifications.length}
                  </span>
                )}
              </h3>
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-faint mx-auto mb-3" />
                <p className="text-muted text-sm">No notifications</p>
                <p className="text-faint text-xs mt-1">All clear!</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-surface/30 transition-colors ${
                      !notification.read ? 'bg-surface/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-bone font-medium text-sm">
                              {notification.title}
                            </div>
                            <div className="text-muted text-xs mt-1 break-words">
                              {notification.message}
                            </div>
                            <div className="flex items-center gap-1 text-faint text-xs mt-2">
                              <Clock className="w-3 h-3" />
                              {timeAgo(notification.timestamp)}
                            </div>
                          </div>
                          
                          {/* Clear button */}
                          <button
                            onClick={() => clearNotification(notification.id)}
                            className="flex-shrink-0 p-1 hover:bg-surface rounded transition-colors"
                            title="Clear notification"
                          >
                            <X className="w-4 h-4 text-muted" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

