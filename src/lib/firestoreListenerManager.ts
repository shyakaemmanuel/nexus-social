import { onSnapshot, Unsubscribe, Query, DocumentReference } from 'firebase/firestore';
import { useCallback } from 'react';
import { FirestoreErrorHandler } from './firestoreErrorHandler';

interface ListenerConfig {
  id: string;
  query: Query | DocumentReference;
  onNext: (snapshot: any) => void;
  onError?: (error: any) => void;
  context?: string;
  retryCount?: number;
  maxRetries?: number;
}

class FirestoreListenerManager {
  private listeners = new Map<string, Unsubscribe>();
  private configs = new Map<string, ListenerConfig>();
  private retryTimers = new Map<string, NodeJS.Timeout>();
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 1 second

  /**
   * Add a new listener with automatic retry and error handling
   */
  addListener(config: ListenerConfig): void {
    const {
      id,
      query,
      onNext,
      onError,
      context = id,
      retryCount = 0,
      maxRetries = this.DEFAULT_MAX_RETRIES
    } = config;

    // Clean up existing listener if it exists
    this.removeListener(id);

    // Store config
    this.configs.set(id, { ...config, retryCount, maxRetries });

    // Clear any existing retry timer
    if (this.retryTimers.has(id)) {
      clearTimeout(this.retryTimers.get(id)!);
      this.retryTimers.delete(id);
    }

    try {
      console.log(`🔥 Setting up Firestore listener: ${context}`);
      
      const unsubscribe = onSnapshot(
        query,
        (snapshot) => {
          try {
            onNext(snapshot);
            // Reset retry count on successful callback
            const currentConfig = this.configs.get(id);
            if (currentConfig) {
              this.configs.set(id, { ...currentConfig, retryCount: 0 });
            }
          } catch (error) {
            console.error(`Error in ${context} callback:`, error);
            this.handleListenerError(id, error, context);
          }
        },
        (error) => {
          console.error(`Firestore listener error in ${context}:`, error);
          this.handleListenerError(id, error, context);
          onError?.(error);
        }
      );

      this.listeners.set(id, unsubscribe);
      console.log(`✅ Firestore listener active: ${context}`);
      
    } catch (error) {
      console.error(`Failed to setup listener ${context}:`, error);
      this.handleListenerError(id, error, context);
    }
  }

  /**
   * Remove a listener and clean up resources
   */
  removeListener(id: string): void {
    const unsubscribe = this.listeners.get(id);
    if (unsubscribe) {
      console.log(`🗑️ Removing Firestore listener: ${id}`);
      unsubscribe();
      this.listeners.delete(id);
    }

    // Clear retry timer
    if (this.retryTimers.has(id)) {
      clearTimeout(this.retryTimers.get(id)!);
      this.retryTimers.delete(id);
    }

    // Remove config
    this.configs.delete(id);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    console.log(`🗑️ Removing all Firestore listeners (${this.listeners.size} active)`);
    
    this.listeners.forEach((unsubscribe, id) => {
      unsubscribe();
    });
    
    this.listeners.clear();
    
    this.retryTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    
    this.retryTimers.clear();
    this.configs.clear();
  }

  /**
   * Handle listener errors with retry logic
   */
  private handleListenerError(id: string, error: any, context: string): void {
    const config = this.configs.get(id);
    if (!config) return;

    const errorInfo = FirestoreErrorHandler.handleError(error, context);
    console.error(`🔥 Firestore listener error handled:`, errorInfo);

    // Clean up current listener
    this.removeListener(id);

    // Check if we should retry
    if (FirestoreErrorHandler.shouldRetry(errorInfo, context)) {
      const retryCount = (config.retryCount || 0) + 1;
      const maxRetries = config.maxRetries || this.DEFAULT_MAX_RETRIES;

      if (retryCount <= maxRetries) {
        // Calculate exponential backoff delay
        const delay = this.RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);
        
        console.log(`🔄 Retrying listener ${context} in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
        
        const timer = setTimeout(() => {
          this.addListener({ ...config, retryCount });
        }, delay);
        
        this.retryTimers.set(id, timer);
      } else {
        console.error(`❌ Max retries exceeded for listener: ${context}`);
        // Log the error for monitoring
        FirestoreErrorHandler.logError(errorInfo, context, { maxRetries, finalRetry: true });
      }
    } else {
      // Error is not recoverable
      console.error(`❌ Non-recoverable error for listener: ${context}`);
      FirestoreErrorHandler.logError(errorInfo, context, { nonRecoverable: true });
    }
  }

  /**
   * Get listener status
   */
  getListenerStatus(): { active: string[]; retrying: string[]; configs: any[] } {
    const active = Array.from(this.listeners.keys());
    const retrying = Array.from(this.retryTimers.keys());
    const configs = Array.from(this.configs.entries()).map(([id, config]) => ({
      id,
      context: config.context,
      retryCount: config.retryCount,
      maxRetries: config.maxRetries
    }));

    return { active, retrying, configs };
  }

  /**
   * Check if a listener is active
   */
  isListenerActive(id: string): boolean {
    return this.listeners.has(id);
  }

  /**
   * Get number of active listeners
   */
  getActiveListenerCount(): number {
    return this.listeners.size;
  }
}

// Singleton instance
const firestoreListenerManager = new FirestoreListenerManager();

// Hook for React components
export const useFirestoreListener = () => {
  const addListener = useCallback((config: ListenerConfig) => {
    firestoreListenerManager.addListener(config);
  }, []);

  const removeListener = useCallback((id: string) => {
    firestoreListenerManager.removeListener(id);
  }, []);

  const removeAllListeners = useCallback(() => {
    firestoreListenerManager.removeAllListeners();
  }, []);

  const getStatus = useCallback(() => {
    return firestoreListenerManager.getListenerStatus();
  }, []);

  const isListenerActive = useCallback((id: string) => {
    return firestoreListenerManager.isListenerActive(id);
  }, []);

  const getActiveListenerCount = useCallback(() => {
    return firestoreListenerManager.getActiveListenerCount();
  }, []);

  return {
    addListener,
    removeListener,
    removeAllListeners,
    getStatus,
    isListenerActive,
    getActiveListenerCount
  };
};

// Global cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    firestoreListenerManager.removeAllListeners();
  });
}

export default firestoreListenerManager;
