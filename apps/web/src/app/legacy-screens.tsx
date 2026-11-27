import { Navigate, useParams } from 'react-router-dom';

type LegacyScreenType =
  | 'dashboard'
  | 'devices'
  | 'register-device'
  | 'cases'
  | 'new-case'
  | 'case-detail'
  | 'login'
  | 'signup';

/** Keep old bookmarks working by routing them into the maintained workspace. */
export default function LegacyScreens({ type }: { type: LegacyScreenType }) {
  const { id } = useParams<{ id: string }>();
  if (type === 'login') return <Navigate to="/login" replace />;
  if (type === 'signup') return <Navigate to="/signup" replace />;
  if (type === 'devices') return <Navigate to="/consumer/devices" replace />;
  if (type === 'register-device') return <Navigate to="/consumer/register-device" replace />;
  if (type === 'new-case') return <Navigate to="/technician/new-case" replace />;
  if (type === 'cases') return <Navigate to="/technician/inbox" replace />;
  if (type === 'case-detail' && id)
    return <Navigate to={`/technician/dashboard?caseId=${encodeURIComponent(id)}`} replace />;
  return <Navigate to="/technician/dashboard" replace />;
}
