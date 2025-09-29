/**
 * Vercel KV Module Index
 * 
 * This module exports all Vercel KV-related functionality
 * for caching frequently accessed data.
 */

export * from './config';
export * from './client';
export * from './cache';
export * from './data-manager';

// Re-export commonly used items
export { 
  getVercelKVClient, 
  initializeVercelKV,
  VercelKVClient 
} from './client';

export { 
  VercelKVCache, 
  vercelKVCaches, 
  getVercelKVCache, 
  createVercelKVCaches 
} from './cache';

export { 
  VercelKVDataManager, 
  getVercelKVDataManager 
} from './data-manager';

// Initialize Vercel KV on module load
export const initializeVercelKVModule = async () => {
  try {
    const client = await initializeVercelKV();
    console.log('✅ Vercel KV module initialized successfully');
    return client;
  } catch (error) {
    console.warn('⚠️ Vercel KV module initialization failed:', error);
    return null;
  }
};
