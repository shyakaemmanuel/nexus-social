import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useFirestoreListener } from '../lib/firestoreListenerManager';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isOnline: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { addListener, removeListener } = useFirestoreListener();
  const authListenerSetupRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update lastActive periodically
  useEffect(() => {
    if (!firebaseUser) return;

    const updateStatus = async () => {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, {
          lastActive: serverTimestamp(),
          // Default to online if not set to busy
          status: user?.status === 'busy' ? 'busy' : 'online'
        });
      } catch (error) {
        console.error('Error updating status:', error);
      }
    };

    // Update immediately on login
    updateStatus();

    // Update every 2 minutes
    const interval = setInterval(updateStatus, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [firebaseUser, user?.status]);

  useEffect(() => {
    if (authListenerSetupRef.current) return;
    authListenerSetupRef.current = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      // Set loading to false immediately after auth state is known
      setLoading(false);
      
      if (!fUser) {
        setUser(null);
        // Clean up user listener
        removeListener('AuthContext-userProfile');
      } else {
        // Listen to user profile in Firestore using managed listener (non-blocking)
        addListener({
          id: 'AuthContext-userProfile',
          query: doc(db, 'users', fUser.uid),
          context: 'AuthContext-userProfile',
          onNext: (doc) => {
            if (doc.exists()) {
              setUser(doc.data() as User);
            }
          },
          onError: (error) => {
            console.error('Error loading user profile:', error);
            // Don't block - user can still use app with partial data
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      removeListener('AuthContext-userProfile');
      authListenerSetupRef.current = false;
    };
  }, [addListener, removeListener]);

  const logout = () => auth.signOut();

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, isOnline, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
