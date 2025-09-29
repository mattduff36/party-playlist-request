/**
 * Admin Notification System Component
 * 
 * This component provides a centralized notification system for critical errors,
 * system alerts, and important admin messages with different severity levels.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  X, 
  Bell, 
  BellOff,
  Wifi,
  WifiOff,
  Database,
  Music,
  Users,
  Settings
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  persistent: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AdminNotificationSystemProps {
  className?: string;
}

export default function AdminNotificationSystem({ className = '' }: AdminNotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Add notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date()
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove non-persistent notifications after 5 seconds
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 5000);
    }
  }, []);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertCircle;
      case 'success':
        return CheckCircle;
      case 'info':
        return Info;
      default:
        return Info;
    }
  };

  // Get notification colors
  const getNotificationColors = (type: string) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-900/20',
          border: 'border-red-600',
          text: 'text-red-400',
          icon: 'text-red-400'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-900/20',
          border: 'border-yellow-600',
          text: 'text-yellow-400',
          icon: 'text-yellow-400'
        };
      case 'success':
        return {
          bg: 'bg-green-900/20',
          border: 'border-green-600',
          text: 'text-green-400',
          icon: 'text-green-400'
        };
      case 'info':
        return {
          bg: 'bg-blue-900/20',
          border: 'border-blue-600',
          text: 'text-blue-400',
          icon: 'text-blue-400'
        };
      default:
        return {
          bg: 'bg-gray-900/20',
          border: 'border-gray-600',
          text: 'text-gray-400',
          icon: 'text-gray-400'
        };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return timestamp.toLocaleDateString();
  };

  // Simulate system notifications (in real app, these would come from Pusher events)
  useEffect(() => {
    // Simulate connection status changes
    const connectionInterval = setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance every 30 seconds
        addNotification({
          type: 'warning',
          title: 'Connection Warning',
          message: 'Spotify connection is unstable. Reconnecting...',
          persistent: false
        });
      }
    }, 30000);

    // Simulate database errors
    const dbErrorInterval = setInterval(() => {
      if (Math.random() < 0.05) { // 5% chance every minute
        addNotification({
          type: 'error',
          title: 'Database Error',
          message: 'Failed to save request data. Retrying...',
          persistent: true,
          action: {
            label: 'Retry',
            onClick: () => {
              addNotification({
                type: 'success',
                title: 'Database Reconnected',
                message: 'Database connection restored successfully.',
                persistent: false
              });
            }
          }
        });
      }
    }, 60000);

    return () => {
      clearInterval(connectionInterval);
      clearInterval(dbErrorInterval);
    };
  }, [addNotification]);

  const unreadCount = notifications.length;
  const errorCount = notifications.filter(n => n.type === 'error').length;
  const warningCount = notifications.filter(n => n.type === 'warning').length;

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        {isMuted ? (
          <BellOff className="w-6 h-6" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isExpanded && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-600">
            <div>
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-gray-400 text-sm">
                {unreadCount} notification{unreadCount !== 1 ? 's' : ''}
                {errorCount > 0 && ` • ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                {warningCount > 0 && ` • ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
              >
                {isMuted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              
              {unreadCount > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-600">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const colors = getNotificationColors(notification.type);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 ${colors.bg} ${colors.border} border-l-4`}
                    >
                      <div className="flex items-start space-x-3">
                        <Icon className={`w-5 h-5 mt-0.5 ${colors.icon}`} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`font-medium ${colors.text}`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={() => removeNotification(notification.id)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <p className="text-gray-300 text-sm mt-1">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-gray-500 text-xs">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                            
                            {notification.action && (
                              <button
                                onClick={notification.action.onClick}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-600 bg-gray-700/50">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                  {errorCount > 0 && warningCount > 0 && ', '}
                  {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
                </span>
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
