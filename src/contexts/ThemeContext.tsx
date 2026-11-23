import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isTransitioning: boolean;
  setTheme: (next: ThemePreference) => void;
  toggleLightDark: () => void;
}

const STORAGE_KEY = 'liquidos-theme';
const THEME_TRANSITION_MS = 550;
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch {
    // ignore storage errors
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const prevResolvedRef = useRef<ResolvedTheme | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const resolvedTheme: ResolvedTheme =
    theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    const isInitialMount = prevResolvedRef.current === null;
    const themeChanged = prevResolvedRef.current !== resolvedTheme;
    prevResolvedRef.current = resolvedTheme;

    if (!isInitialMount && themeChanged && !getPrefersReducedMotion()) {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      root.classList.add('theme-transition');
      setIsTransitioning(true);

      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('theme-transition');
        setIsTransitioning(false);
        transitionTimerRef.current = null;
      }, THEME_TRANSITION_MS);
    }

    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      document.documentElement.classList.remove('theme-transition');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const toggleLightDark = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, isTransitioning, setTheme, toggleLightDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
