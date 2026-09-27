import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { toAppUser } from '@/lib/appUser';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(toAppUser(data.session?.user));
      setIsLoadingAuth(false);
    });
    // Only set state in this callback; calling other supabase methods here can deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAppUser(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    if (shouldRedirect) window.location.assign('/');
  };

  const navigateToLogin = () => {
    window.location.assign('/login?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search));
  };

  const checkUserAuth = useCallback(async () => {}, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
