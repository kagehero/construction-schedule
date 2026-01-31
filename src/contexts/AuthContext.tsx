"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase is not configured. Please set environment variables.');
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Failed to get session:', error);
        setLoading(false);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Failed to load user profile:', error);
        // If profile doesn't exist, create a default viewer profile
        if (error.code === 'PGRST116') {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const { data: newProfile, error: insertError } = await supabase
              .from('user_profiles')
              .insert({
                id: userId,
                email: userData.user.email || '',
                role: 'viewer'
              })
              .select()
              .single();
            
            if (insertError) {
              console.error('Failed to create user profile:', insertError);
            } else {
              setProfile(newProfile as UserProfile);
            }
          }
        }
        setLoading(false);
        return;
      }
      setProfile(data as UserProfile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabaseが設定されていません。環境変数を確認してください。');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
        throw new Error('Invalid login credentials');
      } else if (error.message?.includes('Email not confirmed')) {
        throw new Error('Email not confirmed');
      } else {
        throw error;
      }
    }
    
    if (data.user) {
      await loadUserProfile(data.user.id);
    }
  };

  const signUp = async (email: string, password: string) => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabaseが設定されていません。環境変数を確認してください。');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/schedule`,
      },
    });

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes('User already registered')) {
        throw new Error('このメールアドレスは既に登録されています。');
      } else if (error.message?.includes('Password')) {
        throw new Error('パスワードは6文字以上である必要があります。');
      } else {
        throw error;
      }
    }

    // Check if email confirmation is required
    // If user exists but email is not confirmed, Supabase returns user but requires confirmation
    if (data.user && !data.session) {
      // Email confirmation is required
      // Note: In development, you should enable "Auto Confirm User" in Supabase settings
      // to skip email confirmation
      throw new Error('EMAIL_CONFIRMATION_REQUIRED');
    }

    // Create user profile with viewer role by default
    if (data.user) {
      try {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email || email,
            role: 'viewer' // New users are viewers by default
          });

        if (profileError && profileError.code !== '23505') { // Ignore duplicate key error
          console.error('Failed to create user profile:', profileError);
        }

        // Load the profile if session exists (user is already confirmed)
        if (data.session) {
          await loadUserProfile(data.user.id);
        }
      } catch (profileErr) {
        console.error('Error creating user profile:', profileErr);
        // Continue even if profile creation fails
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin: profile?.role === 'admin',
    isViewer: profile?.role === 'viewer' || profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
