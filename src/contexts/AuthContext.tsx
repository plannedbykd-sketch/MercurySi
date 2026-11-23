import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useTheme, type ThemePreference } from './ThemeContext';

type AllowedProvider = 'password' | 'google.com' | 'apple.com';

export interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  profileSynced: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationState: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitizeDisplayName(rawName: string | null | undefined, email: string | null | undefined): string {
  const candidate = (rawName || email?.split('@')[0] || 'LiquidOS Engineer').trim();
  return candidate.slice(0, 80) || 'LiquidOS Engineer';
}

function resolveProviderId(user: User): AllowedProvider {
  const primary = user.providerData[0]?.providerId;
  if (primary === 'google.com' || primary === 'apple.com' || primary === 'password') {
    return primary;
  }
  return 'password';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileSynced, setProfileSynced] = useState(false);
  const themeRef = useRef<ThemePreference>(theme);
  themeRef.current = theme;

  const syncUserProfile = useCallback(
    async (firebaseUser: User) => {
      if (!firebaseUser.emailVerified) {
        setProfileSynced(false);
        return;
      }
      const userPath = `users/${firebaseUser.uid}`;
      const userRef = doc(db, 'users', firebaseUser.uid);

      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath);
      }

      const displayName = sanitizeDisplayName(firebaseUser.displayName, firebaseUser.email);
      const email = (firebaseUser.email || '').trim().slice(0, 160);
      const providerId = resolveProviderId(firebaseUser);

      if (!snap.exists()) {
        try {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName,
            email,
            providerId,
            themePreference: themeRef.current,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfileSynced(true);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, userPath);
        }
      } else {
        const data = snap.data();
        const savedTheme = data?.themePreference;
        if (savedTheme === 'system' || savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
        setProfileSynced(true);
      }
    },
    [setTheme]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        void syncUserProfile(firebaseUser).catch((err) => {
          console.error('Profile sync failed:', err);
        });
      } else {
        setProfileSynced(false);
      }
    });
    return () => unsub();
  }, [syncUserProfile]);

  // Persist theme preference changes back to Firestore for verified users
  useEffect(() => {
    if (!user || !user.emailVerified || !profileSynced) return;
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    void updateDoc(userRef, {
      themePreference: theme,
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      console.error('Theme sync error:', error, userPath);
    });
  }, [theme, user, profileSynced]);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (displayName: string, email: string, password: string) => {
    const trimmedName = displayName.trim().slice(0, 80);
    if (!trimmedName) {
      throw new Error('Display name is required (1–80 characters).');
    }
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: trimmedName });
    await sendEmailVerification(cred.user);
    setUser({ ...cred.user });
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    await signInWithPopup(auth, provider);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerificationState = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    const refreshed = auth.currentUser;
    setUser({ ...refreshed });
    if (refreshed.emailVerified) {
      await syncUserProfile(refreshed);
    }
    return refreshed.emailVerified;
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        profileSynced,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        signInWithApple,
        sendPasswordReset,
        resendVerificationEmail,
        refreshVerificationState,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
