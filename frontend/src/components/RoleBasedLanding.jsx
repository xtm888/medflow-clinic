import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Role-based landing page router
 * Redirects users to their specialized workspace based on role
 */
const roleDefaultPages = {
  // Clinical roles - specialized workspaces
  pharmacist: '/pharmacist-view',
  optician: '/optician-view',
  lab_technician: '/lab-tech-view',
  receptionist: '/receptionist',

  // Clinical practitioners - go to patient-centric dashboard
  ophthalmologist: '/dashboard',
  doctor: '/dashboard',
  nurse: '/queue',
  orthoptist: '/orthoptic',
  optometrist: '/ophthalmology',

  // Technical roles
  technician: '/devices',
  imaging_tech: '/imaging',
  radiologist: '/imaging',

  // Management and admin
  manager: '/multi-clinic?tab=dashboard',
  accountant: '/financial',
  admin: '/home',

  // Default fallback
  default: '/home'
};

export default function RoleBasedLanding() {
  const { user, isAuthenticated, loading } = useAuth();

  // Still loading auth state
  if (loading) {
    return null;
  }

  // Not authenticated - should be caught by ProtectedRoute, but just in case
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Get the user's role and find the corresponding landing page
  const userRole = user.role?.toLowerCase() || 'default';
  const landingPage = roleDefaultPages[userRole] || roleDefaultPages.default;

  return <Navigate to={landingPage} replace />;
}
