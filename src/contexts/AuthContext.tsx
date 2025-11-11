import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../utils/logger';
import type { UserRole, Admin } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  profile: Admin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<Admin | null>(null);

  const applyMetadataRole = (user: User | null): UserRole | null => {
    if (!user) return null;
    const metaRole = user.user_metadata?.role as string | undefined;
    logger.debug('auth', { event: 'applyMetadataRole', metaRole, metadata: user.user_metadata });
    // Accept both 'admin' and legacy roles - we'll verify against admins table
    if (metaRole === 'admin' || metaRole === 'manufacturer' || metaRole === 'dealer') {
      // Don't set role yet - wait for loadUserProfile to verify from database
      logger.debug('auth', { event: 'applyMetadataRole:legacy_role_detected', metaRole });
      return null; // Return null to force database check
    }
    return null;
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const metadataRole = applyMetadataRole(session.user);
        void loadUserProfile(session.user.id, session.user.email, metadataRole);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const metadataRole = applyMetadataRole(session.user);
        void loadUserProfile(session.user.id, session.user.email, metadataRole);
      } else {
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string, userEmail?: string | null, roleHint?: UserRole | null) {
    try {
      logger.debug('auth', { event: 'loadUserProfile:start', userId, userEmail, roleHint });
      
      // Check admins table
      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      logger.debug('auth', { event: 'loadUserProfile:admin_response', data: admin, error: adminError });

      if (admin && !adminError) {
        logger.info('auth', { event: 'loadUserProfile:admin', admin });
        setRole('admin');
        setProfile(admin);
        setLoading(false);
        return;
      }

      if (adminError) {
        logger.warn('auth', { event: 'loadUserProfile:admin_error', error: adminError });
      }

      // Check by email
      if (userEmail) {
        const { data: adminByEmail, error: adminEmailError } = await supabase
          .from('admins')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();
        
        logger.debug('auth', { event: 'loadUserProfile:admin_email_response', data: adminByEmail, error: adminEmailError });

        if (adminByEmail && !adminEmailError) {
          logger.info('auth', { event: 'loadUserProfile:admin_by_email', admin: adminByEmail });
          setRole('admin');
          setProfile(adminByEmail);
          setLoading(false);
          return;
        }

        if (adminEmailError) {
          logger.warn('auth', { event: 'loadUserProfile:admin_email_error', error: adminEmailError });
        }
      }

      logger.warn('auth', { event: 'loadUserProfile:not_found', userId, userEmail, roleHint });
      if (roleHint) {
        setRole(roleHint);
      } else {
        setRole(null);
      }
      setProfile(null);
      setLoading(false);
    } catch (error) {
      logger.error('auth', { event: 'loadUserProfile:error', error });
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.session) {
      logger.info('auth', { event: 'signIn:session', session: data.session });
      setSession(data.session);
    }
    let signInRoleHint: UserRole | null = null;
    if (data.user) {
      logger.info('auth', { event: 'signIn:user', user: data.user });
      setUser(data.user);
      signInRoleHint = applyMetadataRole(data.user);
    }

    const userRecord =
      data.user ?? (await supabase.auth.getUser().then((result) => result.data.user ?? null));

    const explicitUserId = userRecord?.id ?? null;
    const explicitUserEmail = userRecord?.email ?? null;
    logger.debug('auth', { event: 'signIn:userRecord', explicitUserId, explicitUserEmail, hasUserRecord: !!userRecord });

    if (explicitUserId) {
      setLoading(true);
      if (!signInRoleHint && userRecord) {
        signInRoleHint = (userRecord.user_metadata?.role as UserRole | undefined) ?? null;
      }
      await loadUserProfile(explicitUserId, explicitUserEmail, signInRoleHint);
    } else {
      logger.warn('auth', { event: 'signIn:missing_user_id', userRecord });
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRole(null);
    setProfile(null);
  }

  async function signUp(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    if (error) throw error;
    return data.user ?? null;
  }

  const value = {
    user,
    session,
    role,
    profile,
    loading,
    signIn,
    signOut,
    signUp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

