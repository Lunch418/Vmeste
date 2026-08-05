import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { TabBar } from './components/TabBar';
import { useAuth } from './context/AuthContext';
import { AuthFlow } from './screens/AuthFlow';
import { FeedScreen } from './screens/FeedScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { CreateEventWizard } from './screens/CreateEventWizard';
import { ChatScreen } from './screens/ChatScreen';
import { ConfirmMeetingScreen } from './screens/ConfirmMeetingScreen';
import { RatingScreen } from './screens/RatingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PublicProfileScreen } from './screens/PublicProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen">Загрузка…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthFlow />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <FeedScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/create"
          element={
            <RequireAuth>
              <CreateEventWizard />
            </RequireAuth>
          }
        />
        <Route
          path="/events/:id"
          element={
            <RequireAuth>
              <EventDetailScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/events/:id/chat"
          element={
            <RequireAuth>
              <ChatScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/events/:id/confirm"
          element={
            <RequireAuth>
              <ConfirmMeetingScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/events/:id/rate"
          element={
            <RequireAuth>
              <RatingScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfileScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/users/:id"
          element={
            <RequireAuth>
              <PublicProfileScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsScreen />
            </RequireAuth>
          }
        />
      </Routes>
      {user && <TabBar />}
    </>
  );
}
