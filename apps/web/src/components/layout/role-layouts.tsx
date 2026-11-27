import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ExperienceShell } from '../../pages/experience/experience-shared';
import { useAuthStore } from '../../stores/auth.store';
import { UserRole } from '@repairproof/shared';
import { PageLoading } from '../../app/page-loading';

export type AppRole = 'consumer' | 'technician' | 'shop' | 'admin';
const roleRoutes: Record<AppRole, string[]> = {
  consumer: [
    '/consumer/dashboard',
    '/consumer/devices',
    '/consumer/register-device',
    '/consumer/device-details',
    '/consumer/history',
    '/consumer/case',
    '/consumer/compare',
    '/consumer/approval',
    '/consumer/certificate',
    '/consumer/passport',
    '/consumer/warranties',
    '/consumer/disputes',
    '/consumer/settings',
  ],
  technician: [
    '/technician/dashboard',
    '/technician/inbox',
    '/technician/new-case',
    '/technician/diagnostics',
    '/technician/evidence',
    '/technician/quotes',
    '/technician/execution',
    '/technician/testing',
    '/technician/certificates',
    '/technician/warranties',
  ],
  shop: [
    '/shop/dashboard',
    '/shop/staff',
    '/shop/analytics',
    '/shop/customers',
    '/shop/services',
    '/shop/inventory',
    '/shop/settings',
  ],
  admin: [
    '/admin/overview',
    '/admin/users',
    '/admin/organizations',
    '/admin/disputes',
    '/admin/audit',
    '/admin/health',
    '/admin/config',
  ],
};

function RoleLayout({ role }: { role: AppRole }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  useEffect(() => {
    void loadUser();
  }, [loadUser]);
  const routes = roleRoutes[role];
  if (role === 'consumer') return <Navigate to="/consumer/login" replace />;
  if (isLoading) return <PageLoading />;
  if (!isAuthenticated || !user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  const allowed =
    role === 'admin'
      ? user.role === UserRole.PLATFORM_ADMIN
      : role === 'shop'
        ? user.role === UserRole.SHOP_OWNER
        : user.role === UserRole.TECHNICIAN || user.role === UserRole.SHOP_OWNER;
  if (!allowed) {
    const home =
      user.role === UserRole.PLATFORM_ADMIN
        ? '/admin/overview'
        : user.role === UserRole.SHOP_OWNER
          ? '/shop/dashboard'
          : '/technician/dashboard';
    return <Navigate to={home} replace />;
  }
  if (location.pathname === `/${role}` || location.pathname === `/${role}/`) {
    return <Navigate to={routes[0] ?? '/'} replace />;
  }
  return <ExperienceShell role={role} />;
}

export function ConsumerLayout() {
  return <RoleLayout role="consumer" />;
}
export function TechnicianLayout() {
  return <RoleLayout role="technician" />;
}
export function ShopAdminLayout() {
  return <RoleLayout role="shop" />;
}
export function PlatformAdminLayout() {
  return <RoleLayout role="admin" />;
}
