import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
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
const PlaylistView = lazy(() => import('@/pages/PlaylistView'));
const SearchResults = lazy(() => import('@/pages/SearchResults'));
const Artist = lazy(() => import('@/pages/Artist'));
const MusicSettings = lazy(() => import('@/pages/Settings'));
import { SettingsProvider } from '@/lib/useSettings';
import { PlayerProvider } from '@/lib/PlayerContext';
import { Analytics } from "@vercel/analytics/react"

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

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
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>}>
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
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/contact" element={<Contact />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/watchlist" element={<WatchlistPage />} />
      </Route>

      {/* Music section — its own layout, own PlayerProvider/SettingsProvider,
          shares this app's AuthProvider/Router/Toaster. */}
      <Route path="/music" element={
        <SettingsProvider>
          <PlayerProvider>
            <MusicLayout />
          </PlayerProvider>
        </SettingsProvider>
      }>
        <Route index element={<MusicHome />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="artist/:channelId" element={<Artist />} />
        <Route path="settings" element={<MusicSettings />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="library" element={<Library />} />
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
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <Analytics />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
