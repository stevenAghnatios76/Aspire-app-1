"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  role: "librarian" | "reader";
  name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isLibrarian: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep a ref to the current session so getToken() can read it synchronously
  const sessionRef = useRef<Session | null>(null);
  // Track which user ID we last fetched profile for to avoid duplicates
  const lastFetchedUidRef = useRef<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      // Skip if we already fetched for this user (guards against double-fire)
      if (lastFetchedUidRef.current === userId) return;
      lastFetchedUidRef.current = userId;
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    },
    [supabase]
  );

  useEffect(() => {
    // Use ONLY onAuthStateChange — it fires INITIAL_SESSION immediately,
    // so there's no need for a separate getSession() call.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      sessionRef.current = s;
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        // On TOKEN_REFRESHED (tab refocus), the uid hasn't changed — skip re-fetch
        if (event === "TOKEN_REFRESHED" && lastFetchedUidRef.current === s.user.id) {
          return;
        }
        fetchProfile(s.user.id);
      } else {
        lastFetchedUidRef.current = null;
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    const appUrl =
      window.location.origin ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/auth/callback`,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    lastFetchedUidRef.current = null;
    setUser(null);
    setProfile(null);
    setSession(null);
    sessionRef.current = null;
  }, [supabase]);

  // Return cached session token — no extra getSession() round trip
  const getToken = useCallback(async (): Promise<string | null> => {
    return sessionRef.current?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      isLoading,
      isLibrarian: profile?.role === "librarian",
      signInWithGoogle,
      signOut,
      getToken,
    }),
    [user, profile, session, isLoading, signInWithGoogle, signOut, getToken]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
