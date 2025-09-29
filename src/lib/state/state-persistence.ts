import { useCallback, useEffect, useRef, useState } from 'react';
import type { GlobalEventState } from './global-event.tsx';
import type { OptimisticUpdate } from './optimistic-updates';

/**
 * State Persistence Layer for Offline Scenarios
 * 
 * This module provides state persistence using localStorage and IndexedDB
 * to ensure the application works offline and can recover from crashes.
 */

export interface PersistenceConfig {
  storageType: 'localStorage' | 'indexedDB' | 'both';
  localStorageKey: string;
  indexedDBName: string;
  indexedDBVersion: number;
  maxStorageSize: number; // in MB
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  syncOnReconnect: boolean;
}

export interface PersistedState {
  globalEventState: GlobalEventState;
  optimisticUpdates: OptimisticUpdate[];
  lastSyncTimestamp: number;
  version: string;
  checksum: string;
}

export interface StorageStats {
  used: number;
  available: number;
  percentage: number;
}

export class StatePersistenceManager {
  private config: PersistenceConfig;
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = {
      storageType: 'both',
      localStorageKey: 'party-playlist-state',
      indexedDBName: 'PartyPlaylistDB',
      indexedDBVersion: 1,
      maxStorageSize: 10, // 10MB
      compressionEnabled: false,
      encryptionEnabled: false,
      syncOnReconnect: true,
      ...config,
    };
  }

  /**
   * Initialize persistence layer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
        await this.initializeIndexedDB();
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize persistence layer:', error);
      throw error;
    }
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.indexedDBName, this.config.indexedDBVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('globalState')) {
          const globalStateStore = db.createObjectStore('globalState', { keyPath: 'id' });
          globalStateStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('optimisticUpdates')) {
          const updatesStore = db.createObjectStore('optimisticUpdates', { keyPath: 'id' });
          updatesStore.createIndex('timestamp', 'timestamp', { unique: false });
          updatesStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Save state to storage
   */
  async saveState(
    globalEventState: GlobalEventState,
    optimisticUpdates: OptimisticUpdate[] = []
  ): Promise<void> {
    await this.initialize();

    const persistedState: PersistedState = {
      globalEventState,
      optimisticUpdates,
      lastSyncTimestamp: Date.now(),
      version: '1.0.0',
      checksum: this.calculateChecksum(globalEventState, optimisticUpdates),
    };

    // Save to localStorage
    if (this.config.storageType === 'localStorage' || this.config.storageType === 'both') {
      await this.saveToLocalStorage(persistedState);
    }

    // Save to IndexedDB
    if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
      await this.saveToIndexedDB(persistedState);
    }
  }

  /**
   * Load state from storage
   */
  async loadState(): Promise<PersistedState | null> {
    await this.initialize();

    try {
      // Try IndexedDB first (more reliable)
      if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
        const indexedDBState = await this.loadFromIndexedDB();
        if (indexedDBState) {
          return indexedDBState;
        }
      }

      // Fallback to localStorage
      if (this.config.storageType === 'localStorage' || this.config.storageType === 'both') {
        return await this.loadFromLocalStorage();
      }

      return null;
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      return null;
    }
  }

  /**
   * Save to localStorage
   */
  private async saveToLocalStorage(state: PersistedState): Promise<void> {
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(this.config.localStorageKey, serialized);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // Clear old data and try again
        await this.clearOldData();
        const serialized = JSON.stringify(state);
        localStorage.setItem(this.config.localStorageKey, serialized);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load from localStorage
   */
  private async loadFromLocalStorage(): Promise<PersistedState | null> {
    try {
      const serialized = localStorage.getItem(this.config.localStorageKey);
      if (!serialized) return null;

      const state = JSON.parse(serialized) as PersistedState;
      
      // Validate checksum
      if (!this.validateChecksum(state)) {
        console.warn('Checksum validation failed for localStorage state');
        return null;
      }

      return state;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Save to IndexedDB
   */
  private async saveToIndexedDB(state: PersistedState): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['globalState'], 'readwrite');
      const store = transaction.objectStore('globalState');
      
      const request = store.put({
        id: 'current',
        ...state,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load from IndexedDB
   */
  private async loadFromIndexedDB(): Promise<PersistedState | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['globalState'], 'readonly');
      const store = transaction.objectStore('globalState');
      const request = store.get('current');

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Validate checksum
        if (!this.validateChecksum(result)) {
          console.warn('Checksum validation failed for IndexedDB state');
          resolve(null);
          return;
        }

        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save optimistic updates
   */
  async saveOptimisticUpdates(updates: OptimisticUpdate[]): Promise<void> {
    await this.initialize();

    if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
      await this.saveUpdatesToIndexedDB(updates);
    }
  }

  /**
   * Load optimistic updates
   */
  async loadOptimisticUpdates(): Promise<OptimisticUpdate[]> {
    await this.initialize();

    if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
      return await this.loadUpdatesFromIndexedDB();
    }

    return [];
  }

  /**
   * Save updates to IndexedDB
   */
  private async saveUpdatesToIndexedDB(updates: OptimisticUpdate[]): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['optimisticUpdates'], 'readwrite');
      const store = transaction.objectStore('optimisticUpdates');
      
      // Clear existing updates
      store.clear();

      // Add new updates
      const requests = updates.map(update => store.add(update));
      
      Promise.all(requests.map(req => new Promise((res, rej) => {
        req.onsuccess = () => res(undefined);
        req.onerror = () => rej(req.error);
      }))).then(() => resolve()).catch(reject);
    });
  }

  /**
   * Load updates from IndexedDB
   */
  private async loadUpdatesFromIndexedDB(): Promise<OptimisticUpdate[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['optimisticUpdates'], 'readonly');
      const store = transaction.objectStore('optimisticUpdates');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Calculate checksum for state validation
   */
  private calculateChecksum(globalEventState: GlobalEventState, optimisticUpdates: OptimisticUpdate[]): string {
    const data = JSON.stringify({ globalEventState, optimisticUpdates });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Validate checksum
   */
  private validateChecksum(state: PersistedState): boolean {
    const expectedChecksum = this.calculateChecksum(state.globalEventState, state.optimisticUpdates);
    return state.checksum === expectedChecksum;
  }

  /**
   * Clear old data to free up space
   */
  private async clearOldData(): Promise<void> {
    // Clear localStorage
    if (this.config.storageType === 'localStorage' || this.config.storageType === 'both') {
      localStorage.removeItem(this.config.localStorageKey);
    }

    // Clear IndexedDB old entries
    if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
      await this.clearOldIndexedDBData();
    }
  }

  /**
   * Clear old IndexedDB data
   */
  private async clearOldIndexedDBData(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['globalState', 'optimisticUpdates'], 'readwrite');
      
      // Clear old global state entries (keep only current)
      const globalStateStore = transaction.objectStore('globalState');
      const globalStateRequest = globalStateStore.getAll();
      
      globalStateRequest.onsuccess = () => {
        const entries = globalStateRequest.result;
        const currentTime = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        entries.forEach(entry => {
          if (entry.id !== 'current' && (currentTime - entry.timestamp) > maxAge) {
            globalStateStore.delete(entry.id);
          }
        });
      };

      // Clear old optimistic updates
      const updatesStore = transaction.objectStore('optimisticUpdates');
      const updatesRequest = updatesStore.getAll();
      
      updatesRequest.onsuccess = () => {
        const updates = updatesRequest.result;
        const currentTime = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 1 day
        
        updates.forEach(update => {
          if ((currentTime - update.timestamp) > maxAge) {
            updatesStore.delete(update.id);
          }
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    await this.initialize();

    let used = 0;
    let available = 0;

    // Calculate localStorage usage
    if (this.config.storageType === 'localStorage' || this.config.storageType === 'both') {
      const localStorageData = localStorage.getItem(this.config.localStorageKey);
      if (localStorageData) {
        used += new Blob([localStorageData]).size;
      }
    }

    // Calculate IndexedDB usage (approximate)
    if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
      // This is a simplified calculation
      used += 1024; // Assume 1KB for IndexedDB
    }

    // Estimate available space (this is browser-dependent)
    const maxStorage = this.config.maxStorageSize * 1024 * 1024; // Convert MB to bytes
    available = maxStorage - used;

    return {
      used,
      available,
      percentage: (used / maxStorage) * 100,
    };
  }

  /**
   * Clear all persisted data
   */
  async clearAllData(): Promise<void> {
    await this.initialize();

    // Clear localStorage
    if (this.config.storageType === 'localStorage' || this.config.storageType === 'both') {
      localStorage.removeItem(this.config.localStorageKey);
    }

    // Clear IndexedDB
    if (this.config.storageType === 'indexedDB' || this.config.storageType === 'both') {
      await this.clearIndexedDB();
    }
  }

  /**
   * Clear IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['globalState', 'optimisticUpdates', 'syncQueue'], 'readwrite');
      
      transaction.objectStore('globalState').clear();
      transaction.objectStore('optimisticUpdates').clear();
      transaction.objectStore('syncQueue').clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

/**
 * Hook for state persistence
 */
export function useStatePersistence(config: Partial<PersistenceConfig> = {}) {
  const [persistenceManager] = useState(() => new StatePersistenceManager(config));
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Initialize persistence manager
  useEffect(() => {
    persistenceManager.initialize().then(() => {
      setIsInitialized(true);
    });
  }, [persistenceManager]);

  // Save state
  const saveState = useCallback(async (
    globalEventState: GlobalEventState,
    optimisticUpdates: OptimisticUpdate[] = []
  ) => {
    if (!isInitialized) return;
    await persistenceManager.saveState(globalEventState, optimisticUpdates);
  }, [persistenceManager, isInitialized]);

  // Load state
  const loadState = useCallback(async () => {
    if (!isInitialized) return null;
    return await persistenceManager.loadState();
  }, [persistenceManager, isInitialized]);

  // Save optimistic updates
  const saveOptimisticUpdates = useCallback(async (updates: OptimisticUpdate[]) => {
    if (!isInitialized) return;
    await persistenceManager.saveOptimisticUpdates(updates);
  }, [persistenceManager, isInitialized]);

  // Load optimistic updates
  const loadOptimisticUpdates = useCallback(async () => {
    if (!isInitialized) return [];
    return await persistenceManager.loadOptimisticUpdates();
  }, [persistenceManager, isInitialized]);

  // Get storage stats
  const getStorageStats = useCallback(async () => {
    if (!isInitialized) return null;
    const stats = await persistenceManager.getStorageStats();
    setStorageStats(stats);
    return stats;
  }, [persistenceManager, isInitialized]);

  // Clear all data
  const clearAllData = useCallback(async () => {
    if (!isInitialized) return;
    await persistenceManager.clearAllData();
  }, [persistenceManager, isInitialized]);

  return {
    isInitialized,
    storageStats,
    saveState,
    loadState,
    saveOptimisticUpdates,
    loadOptimisticUpdates,
    getStorageStats,
    clearAllData,
  };
}

export type { PersistenceConfig, PersistedState, StorageStats };
