/**
 * Vercel KV Data Manager Tests
 */

import { VercelKVDataManager, getVercelKVDataManager } from '../data-manager';
import { getVercelKVClient } from '../client';

// Mock Vercel KV client
jest.mock('../client', () => ({
  getVercelKVClient: jest.fn(() => ({
    isReady: jest.fn().mockReturnValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    mget: jest.fn().mockResolvedValue([]),
    keys: jest.fn().mockResolvedValue([]),
  })),
}));

describe('VercelKVDataManager', () => {
  let dataManager: VercelKVDataManager;
  let mockKV: any;

  beforeEach(() => {
    mockKV = getVercelKVClient();
    dataManager = new VercelKVDataManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('event data management', () => {
    const mockEvent: any = {
      id: 'event-123',
      name: 'Test Event',
      status: 'live',
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        allowRequests: true,
        maxRequestsPerUser: 5,
        autoApprove: false,
      },
      stats: {
        totalRequests: 10,
        approvedRequests: 8,
        rejectedRequests: 2,
        activeUsers: 5,
      },
    };

    it('should get event data', async () => {
      mockKV.get.mockResolvedValueOnce(mockEvent);

      const result = await dataManager.getEvent('event-123');
      expect(result).toEqual(mockEvent);
    });

    it('should set event data', async () => {
      const result = await dataManager.setEvent(mockEvent);
      expect(result).toBe(true);
    });

    it('should update event stats', async () => {
      mockKV.get.mockResolvedValueOnce(mockEvent);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.updateEventStats('event-123', {
        totalRequests: 15,
        activeUsers: 8,
      });

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        'event:event-123',
        expect.objectContaining({
          stats: expect.objectContaining({
            totalRequests: 15,
            activeUsers: 8,
          }),
        }),
        300
      );
    });

    it('should delete event data', async () => {
      const result = await dataManager.deleteEvent('event-123');
      expect(result).toBe(true);
    });
  });

  describe('user data management', () => {
    const mockUser: any = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      spotifyId: 'spotify-123',
      preferences: {
        notifications: true,
        autoPlay: false,
      },
      stats: {
        totalRequests: 5,
        approvedRequests: 4,
        rejectedRequests: 1,
      },
    };

    it('should get user data', async () => {
      mockKV.get.mockResolvedValueOnce(mockUser);

      const result = await dataManager.getUser('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should set user data', async () => {
      const result = await dataManager.setUser(mockUser);
      expect(result).toBe(true);
    });

    it('should update user stats', async () => {
      mockKV.get.mockResolvedValueOnce(mockUser);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.updateUserStats('user-123', {
        totalRequests: 10,
      });

      expect(result).toBe(true);
    });

    it('should delete user data', async () => {
      const result = await dataManager.deleteUser('user-123');
      expect(result).toBe(true);
    });
  });

  describe('spotify data management', () => {
    const mockSpotifyData: any = {
      userId: 'user-123',
      deviceId: 'device-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      devices: [
        {
          id: 'device-123',
          name: 'Test Device',
          type: 'Computer',
          isActive: true,
        },
      ],
    };

    it('should get spotify data', async () => {
      mockKV.get.mockResolvedValueOnce(mockSpotifyData);

      const result = await dataManager.getSpotifyData('user-123');
      expect(result).toEqual(mockSpotifyData);
    });

    it('should set spotify data', async () => {
      const result = await dataManager.setSpotifyData(mockSpotifyData);
      expect(result).toBe(true);
    });

    it('should get spotify devices', async () => {
      mockKV.get.mockResolvedValueOnce(mockSpotifyData);

      const result = await dataManager.getSpotifyDevices('user-123');
      expect(result).toEqual(mockSpotifyData.devices);
    });

    it('should set spotify devices', async () => {
      mockKV.get.mockResolvedValueOnce(mockSpotifyData);
      mockKV.set.mockResolvedValueOnce(true);

      const newDevices = [
        { id: 'device-456', name: 'New Device', type: 'Phone', isActive: false },
      ];

      const result = await dataManager.setSpotifyDevices('user-123', newDevices);
      expect(result).toBe(true);
    });

    it('should delete spotify data', async () => {
      const result = await dataManager.deleteSpotifyData('user-123');
      expect(result).toBe(true);
    });
  });

  describe('session data management', () => {
    const mockSession: any = {
      id: 'session-123',
      userId: 'user-123',
      eventId: 'event-123',
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    };

    it('should get session data', async () => {
      mockKV.get.mockResolvedValueOnce(mockSession);

      const result = await dataManager.getSession('session-123');
      expect(result).toEqual(mockSession);
    });

    it('should set session data', async () => {
      const result = await dataManager.setSession(mockSession);
      expect(result).toBe(true);
    });

    it('should update session activity', async () => {
      mockKV.get.mockResolvedValueOnce(mockSession);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.updateSessionActivity('session-123');
      expect(result).toBe(true);
    });

    it('should delete session data', async () => {
      const result = await dataManager.deleteSession('session-123');
      expect(result).toBe(true);
    });
  });

  describe('request data management', () => {
    const mockRequest: any = {
      id: 'request-123',
      eventId: 'event-123',
      userId: 'user-123',
      songId: 'song-123',
      songName: 'Test Song',
      artist: 'Test Artist',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should get request data', async () => {
      mockKV.get.mockResolvedValueOnce(mockRequest);

      const result = await dataManager.getRequest('request-123');
      expect(result).toEqual(mockRequest);
    });

    it('should set request data', async () => {
      const result = await dataManager.setRequest(mockRequest);
      expect(result).toBe(true);
    });

    it('should get requests by event', async () => {
      mockKV.get.mockResolvedValueOnce(['request-123', 'request-456']);
      mockKV.mget.mockResolvedValueOnce([mockRequest, null]);

      const result = await dataManager.getRequestsByEvent('event-123');
      expect(result).toEqual([mockRequest]);
    });

    it('should add request to event', async () => {
      mockKV.get.mockResolvedValueOnce(['request-123']);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.addRequestToEvent('event-123', 'request-456');
      expect(result).toBe(true);
    });

    it('should remove request from event', async () => {
      mockKV.get.mockResolvedValueOnce(['request-123', 'request-456']);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.removeRequestFromEvent('event-123', 'request-123');
      expect(result).toBe(true);
    });

    it('should get requests by user', async () => {
      mockKV.get.mockResolvedValueOnce(['request-123', 'request-456']);
      mockKV.mget.mockResolvedValueOnce([mockRequest, null]);

      const result = await dataManager.getRequestsByUser('user-123');
      expect(result).toEqual([mockRequest]);
    });

    it('should add request to user', async () => {
      mockKV.get.mockResolvedValueOnce(['request-123']);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.addRequestToUser('user-123', 'request-456');
      expect(result).toBe(true);
    });

    it('should remove request from user', async () => {
      mockKV.get.mockResolvedValueOnce(['request-123', 'request-456']);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.removeRequestFromUser('user-123', 'request-123');
      expect(result).toBe(true);
    });

    it('should delete request data', async () => {
      const result = await dataManager.deleteRequest('request-123');
      expect(result).toBe(true);
    });
  });

  describe('statistics management', () => {
    it('should get event stats', async () => {
      const mockEvent = {
        stats: { totalRequests: 10, approvedRequests: 8, rejectedRequests: 2, activeUsers: 5 },
      };
      mockKV.get.mockResolvedValueOnce(mockEvent);

      const result = await dataManager.getEventStats('event-123');
      expect(result).toEqual(mockEvent.stats);
    });

    it('should get user stats', async () => {
      const mockUser = {
        stats: { totalRequests: 5, approvedRequests: 4, rejectedRequests: 1 },
      };
      mockKV.get.mockResolvedValueOnce(mockUser);

      const result = await dataManager.getUserStats('user-123');
      expect(result).toEqual(mockUser.stats);
    });

    it('should increment event stat', async () => {
      const mockEvent = {
        stats: { totalRequests: 10, approvedRequests: 8, rejectedRequests: 2, activeUsers: 5 },
        updatedAt: new Date(),
      };
      mockKV.get.mockResolvedValueOnce(mockEvent);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.incrementEventStat('event-123', 'totalRequests');
      expect(result).toBe(true);
    });

    it('should increment user stat', async () => {
      const mockUser = {
        stats: { totalRequests: 5, approvedRequests: 4, rejectedRequests: 1 },
      };
      mockKV.get.mockResolvedValueOnce(mockUser);
      mockKV.set.mockResolvedValueOnce(true);

      const result = await dataManager.incrementUserStat('user-123', 'totalRequests');
      expect(result).toBe(true);
    });
  });

  describe('batch operations', () => {
    it('should get multiple events', async () => {
      const mockEvents = [{ id: 'event-1' }, { id: 'event-2' }];
      mockKV.mget.mockResolvedValueOnce(mockEvents);

      const result = await dataManager.getMultipleEvents(['event-1', 'event-2']);
      expect(result).toEqual(mockEvents);
    });

    it('should get multiple users', async () => {
      const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }];
      mockKV.mget.mockResolvedValueOnce(mockUsers);

      const result = await dataManager.getMultipleUsers(['user-1', 'user-2']);
      expect(result).toEqual(mockUsers);
    });

    it('should get multiple requests', async () => {
      const mockRequests = [{ id: 'request-1' }, { id: 'request-2' }];
      mockKV.mget.mockResolvedValueOnce(mockRequests);

      const result = await dataManager.getMultipleRequests(['request-1', 'request-2']);
      expect(result).toEqual(mockRequests);
    });
  });

  describe('cleanup operations', () => {
    it('should cleanup expired sessions', async () => {
      const mockSessions = ['session-1', 'session-2'];
      mockKV.keys.mockResolvedValueOnce(mockSessions);
      mockKV.get.mockResolvedValueOnce({
        lastActivity: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });
      mockKV.get.mockResolvedValueOnce({
        lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      });
      mockKV.del.mockResolvedValueOnce(true);

      const result = await dataManager.cleanupExpiredSessions();
      expect(result).toBe(1); // Only one session should be deleted
    });

    it('should cleanup old requests', async () => {
      const mockRequests = ['request-1', 'request-2'];
      mockKV.keys.mockResolvedValueOnce(mockRequests);
      mockKV.get.mockResolvedValueOnce({
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      });
      mockKV.get.mockResolvedValueOnce({
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      });
      mockKV.del.mockResolvedValueOnce(true);

      const result = await dataManager.cleanupOldRequests();
      expect(result).toBe(1); // Only one request should be deleted
    });
  });

  describe('statistics', () => {
    it('should return data manager statistics', async () => {
      mockKV.keys.mockResolvedValueOnce(['event-1', 'event-2']); // events
      mockKV.keys.mockResolvedValueOnce(['user-1', 'user-2']); // users
      mockKV.keys.mockResolvedValueOnce(['session-1']); // sessions
      mockKV.keys.mockResolvedValueOnce(['request-1', 'request-2', 'request-3']); // requests
      mockKV.keys.mockResolvedValueOnce(['spotify-1']); // spotify data

      const result = await dataManager.getStatistics();
      expect(result).toEqual({
        events: 2,
        users: 2,
        sessions: 1,
        requests: 3,
        spotifyData: 1,
      });
    });
  });
});

describe('getVercelKVDataManager', () => {
  it('should return singleton instance', () => {
    const manager1 = getVercelKVDataManager();
    const manager2 = getVercelKVDataManager();
    expect(manager1).toBe(manager2);
  });
});
