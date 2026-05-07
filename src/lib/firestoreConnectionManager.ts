import { Firestore, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

interface ConnectionStatus {
  connected: boolean;
  lastConnected: number | null;
  lastDisconnected: number | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

class FirestoreConnectionManager {
  private static instance: FirestoreConnectionManager;
  private db: Firestore | null = null;
  private connectionStatus: ConnectionStatus = {
    connected: true, // Assume connected initially to prevent blocking
    lastConnected: Date.now(),
    lastDisconnected: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private readonly RECONNECT_DELAY_BASE = 1000; // 1 second
  private readonly CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

  private constructor() {
    // Don't auto-initialize to prevent blocking
  }

  static getInstance(): FirestoreConnectionManager {
    if (!FirestoreConnectionManager.instance) {
      FirestoreConnectionManager.instance = new FirestoreConnectionManager();
    }
    return FirestoreConnectionManager.instance;
  }

  private initializeConnection(): void {
    if (this.db) return; // Already initialized

    try {
      console.log('🔥 Initializing Firestore connection...');
      
      // Extract only Firebase config fields
      const firebaseAppConfig = {
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
        measurementId: firebaseConfig.measurementId
      };

      // Initialize Firebase app if not already initialized
      const app = getApps().length === 0 ? initializeApp(firebaseAppConfig) : getApp();
      this.db = getFirestore(app);

      // Set up connection monitoring
      this.setupConnectionMonitoring();
      
      console.log('✅ Firestore connection initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Firestore connection:', error);
      // Don't throw - allow app to continue
    }
  }

  private setupConnectionMonitoring(): void {
    if (!this.db) return;

    // Check connection status periodically
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, this.CONNECTION_CHECK_INTERVAL);

    // Listen for connection state changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network connection restored');
        this.attemptReconnect();
      });

      window.addEventListener('offline', () => {
        console.log('📵 Network connection lost');
        this.handleDisconnection();
      });
    }
  }

  private checkConnection(): void {
    try {
      // Simple connection check - try to perform a lightweight operation
      // This is a basic check - in production you might want more sophisticated monitoring
      const now = Date.now();
      
      if (this.connectionStatus.connected) {
        // Connection is still active
        this.connectionStatus.lastConnected = now;
      } else {
        // Try to reconnect if we haven't exceeded max attempts
        this.attemptReconnect();
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      this.handleConnectionError(error);
    }
  }

  private handleConnectionError(error: any): void {
    console.error('🔥 Firestore connection error:', error);
    this.handleDisconnection();
    
    // Schedule reconnection attempt
    this.scheduleReconnect();
  }

  private handleDisconnection(): void {
    this.connectionStatus.connected = false;
    this.connectionStatus.lastDisconnected = Date.now();
    
    console.log('📴 Firestore connection lost');
    
    // Notify listeners (you could implement an event system here)
    this.notifyConnectionChange(false);
  }

  private scheduleReconnect(): void {
    if (this.connectionStatus.reconnectAttempts >= this.connectionStatus.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    // Clear existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate delay with exponential backoff
    const delay = this.RECONNECT_DELAY_BASE * Math.pow(2, this.connectionStatus.reconnectAttempts);
    
    console.log(`🔄 Scheduling reconnection attempt in ${delay}ms (attempt ${this.connectionStatus.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  private attemptReconnect(): void {
    if (this.connectionStatus.reconnectAttempts >= this.connectionStatus.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.connectionStatus.reconnectAttempts++;
    
    try {
      console.log(`🔄 Attempting to reconnect to Firestore (attempt ${this.connectionStatus.reconnectAttempts})`);
      
      // Re-initialize connection
      this.initializeConnection();
      
      // If we get here, connection was successful
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = Date.now();
      this.connectionStatus.reconnectAttempts = 0;
      
      console.log('✅ Firestore connection restored');
      this.notifyConnectionChange(true);
      
    } catch (error) {
      console.error(`❌ Reconnection attempt ${this.connectionStatus.reconnectAttempts} failed:`, error);
      this.handleConnectionError(error);
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    // You could implement an event system or callback system here
    // For now, we'll just log it
    if (connected) {
      console.log('🟢 Firestore connection status: CONNECTED');
    } else {
      console.log('🔴 Firestore connection status: DISCONNECTED');
    }
  }

  public getFirestore(): Firestore {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    return this.db;
  }

  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  public isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  public forceReconnect(): void {
    console.log('🔄 Forcing reconnection to Firestore...');
    this.handleDisconnection();
    this.connectionStatus.reconnectAttempts = 0;
    this.attemptReconnect();
  }

  public cleanup(): void {
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    console.log('🧹 Firestore connection manager cleaned up');
  }
}

// Export singleton instance
export const firestoreConnectionManager = FirestoreConnectionManager.getInstance();

// Export convenience function to get Firestore instance
export const getFirestoreInstance = (): Firestore => {
  return firestoreConnectionManager.getFirestore();
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    firestoreConnectionManager.cleanup();
  });
}

export default firestoreConnectionManager;
