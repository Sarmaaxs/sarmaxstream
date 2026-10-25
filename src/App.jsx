import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import RouteMemory from '@/components/RouteMemory';
import AuthReturnHandler from '@/components/AuthReturnHandler';
import CookieBanner, { useConsent } from '@/components/CookieBanner';
import NativeBackButton from '@/components/NativeBackButton';
import OfflineBanner from '@/components/OfflineBanner';
import InstallPrompt from '@/components/InstallPrompt';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
// Add page imports here
import Home from '@/pages/Home';
const SearchPage = lazy(() => import('@/pages/Search'));
const TitleDetail = lazy(() => import('@/pages/TitleDetail'));
const AnimePage = lazy(() => import('@/pages/Anime'));
const Books = lazy(() => import('@/pages/Books'));
const BookReader = lazy(() => import('@/pages/BookReader'));
const AnimeDetail = lazy(() => import('@/pages/AnimeDetail'));
const AnimeResolve = lazy(() => import('@/pages/AnimeResolve'));
const WatchlistPage = lazy(() => import('@/pages/Watchlist'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Terms = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.Privacy })));
const Faq = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.Faq })));
const Contact = lazy(() => import('@/pages/InfoPages').then((m) => ({ default: m.Contact })));
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
// Music section
import MusicLayout from '@/components/MusicLayout';
const MusicHome = lazy(() => import('@/pages/MusicHome'));
const Library = lazy(() => import('@/pages/Library'));
const Downloads = lazy(() => import('@/pages/Downloads'));
const PlaylistView = lazy(() => import('@/pages/PlaylistView'));
const SearchResults = lazy(() => import('@/pages/SearchResults'));
const Artist = lazy(() => import('@/pages/Artist'));
const MusicSettings = lazy(() => import('@/pages/Settings'));
import { SettingsProvider } from '@/lib/useSettings';
import { PlayerProvider } from '@/lib/PlayerContext';
// Analytics is not needed to show the page, so it loads separately, later.
const Analytics = lazy(() => import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })));

// Visit statistics only run after the person chose "Accept all" in the cookie notice.
const AnalyticsGate = () => {
  const consent = useConsent();
  return consent === 'all' ? <Suspense fallback={null}><Analytics /></Suspense> : null;
};

// Signed-out visitors of a protected page go to sign-in and come back afterwards.
const LoginRedirect = () => {
  const l = useLocation();
  return <Navigate to={'/login?returnTo=' + encodeURIComponent(l.pathname + l.search)} replace />;
};

const AuthenticatedApp = () => {
  const { authError, navigateToLogin } = useAuth();

  // NOTE: we no longer block the whole app with a spinner while login is checked.
  // Public pages show immediately; ProtectedRoute waits by itself where it really matters.

  // After the page is idle, quietly download the pages people open next,
  // so tapping a movie or search feels instant.
  useEffect(() => {
    const warm = () => {
      // download the main pages quietly so they also open when you are offline
      import('@/pages/TitleDetail');
      import('@/pages/Search');
      import('@/pages/Books');
      import('@/pages/BookReader');
      import('@/pages/Anime');
      import('@/pages/MusicHome');
      import('@/pages/Downloads');
      import('@/pages/Library');
      import('@/pages/Watchlist');
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warm, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 2500);
    return () => clearTimeout(t);
  }, []);

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <>
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/anime" element={<AnimePage />} />
      <Route path="/books" element={<Books />} />
      <Route path="/books/read/:id" element={<BookReader />} />
      <Route path="/title/anime/:id" element={<AnimeDetail />} />
      <Route path="/title/anime-tv/:id" element={<AnimeResolve kind="tv" />} />
      <Route path="/title/anime-movie/:id" element={<AnimeResolve kind="movie" />} />
      <Route path="/title/:type/:id" element={<TitleDetail />} />
      <Route path="/settings" element={<MusicSettings />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/contact" element={<Contact />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
        <Route path="/watchlist" element={<WatchlistPage />} />
      </Route>

      {/* Music section — its own layout, own PlayerProvider/SettingsProvider,
          shares this app's AuthProvider/Router/Toaster. */}
      <Route path="/music" element={
        <PlayerProvider>
          <MusicLayout />
        </PlayerProvider>
      }>
        <Route index element={<MusicHome />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="artist/:channelId" element={<Artist />} />
        <Route path="settings" element={<MusicSettings />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
          <Route path="library" element={<Library />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="playlist/:id" element={<PlaylistView />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    <Footer />
    {/* Phones only (md:hidden); hides itself on the auth routes. */}
    <MobileBottomNav />
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <SettingsProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <RouteMemory />
          <AuthReturnHandler />
          <CookieBanner />
          <NativeBackButton />
          <OfflineBanner />
          <InstallPrompt />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <AnalyticsGate />
      </QueryClientProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
