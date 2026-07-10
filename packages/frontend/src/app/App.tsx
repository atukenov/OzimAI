import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { VerifyScreen } from '../features/auth/VerifyScreen';
import { AppLayout } from './AppLayout';
import { DialoguesScreen } from '../features/dialogues/DialoguesScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { PatientsScreen } from '../features/patients/PatientsScreen';
import { AiKnowledgeScreen } from '../features/ai-knowledge/AiKnowledgeScreen';
import { ReportsScreen } from '../features/reports/ReportsScreen';
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/auth/verify" element={<VerifyScreen />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingWizard />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dialogues" replace />} />
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
