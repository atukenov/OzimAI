import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { AppLayout } from './AppLayout';
import { DialoguesScreen } from '../features/dialogues/DialoguesScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { PatientsScreen } from '../features/patients/PatientsScreen';
import { AiKnowledgeScreen } from '../features/ai-knowledge/AiKnowledgeScreen';
import { ReportsScreen } from '../features/reports/ReportsScreen';
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard';
import { WebChatScreen } from '../features/webchat/WebChatScreen';
import { LandingPage } from '../features/landing/LandingPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/auth/verify" element={<Navigate to="/login" replace />} />
      {/* Public patient chat (shareable link + widget iframe) — no panel auth. */}
      <Route path="/c/:slug" element={<WebChatScreen />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingWizard />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="dialogues" element={<DialoguesScreen />} />
        <Route path="dialogues/:conversationId" element={<DialoguesScreen />} />
        <Route path="calendar" element={<CalendarScreen />} />
        <Route path="patients" element={<PatientsScreen />} />
        <Route path="ai" element={<AiKnowledgeScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
