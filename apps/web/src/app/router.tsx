import React, { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { RouteErrorBoundary } from './route-error-boundary';
import { PageLoading } from './page-loading';
import { AppLayout } from '../components/layout/AppLayout';

const LandingPage = lazy(() =>
  import('../pages/experience/landing-page').then((m) => ({ default: m.LandingPage })),
);
const AccountAccessPage = lazy(() =>
  import('../pages/experience/account-access-page').then((m) => ({ default: m.AccountAccessPage })),
);
const ConsumerLayout = lazy(() =>
  import('../components/layout/role-layouts').then((m) => ({ default: m.ConsumerLayout })),
);
const TechnicianLayout = lazy(() =>
  import('../components/layout/role-layouts').then((m) => ({ default: m.TechnicianLayout })),
);
const ShopAdminLayout = lazy(() =>
  import('../components/layout/role-layouts').then((m) => ({ default: m.ShopAdminLayout })),
);
const PlatformAdminLayout = lazy(() =>
  import('../components/layout/role-layouts').then((m) => ({ default: m.PlatformAdminLayout })),
);
const LegacyScreens = lazy(() => import('../app/legacy-screens'));
const PublicScreens = lazy(() => import('../app/public-screens'));

function Suspended({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeoMetadata />
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </>
  );
}

const homeTitle = 'RepairProof | Electronics Repair Documentation & Verification';
const homeDescription =
  'Document electronics repairs from diagnosis and customer approval through repair actions and post-repair checks. Keep a clear digital repair record.';

function seoForPath(path: string) {
  if (path === '/') return { title: homeTitle, description: homeDescription, indexable: true };
  if (path === '/login' || path === '/consumer/login')
    return {
      title: 'Sign in | RepairProof',
      description: 'Sign in to your RepairProof account.',
      indexable: false,
    };
  if (path === '/signup' || path === '/consumer/register')
    return {
      title: 'Create an account | RepairProof',
      description: 'Create a RepairProof account.',
      indexable: false,
    };
  if (path.startsWith('/authorize/'))
    return {
      title: 'Customer repair authorization | RepairProof',
      description: 'Private customer repair authorization page.',
      indexable: false,
    };
  if (path === '/verify' || path.startsWith('/verify/'))
    return {
      title: 'Repair record lookup | RepairProof',
      description: 'Private repair record lookup.',
      indexable: false,
    };
  if (path.startsWith('/consumer/'))
    return {
      title: 'Consumer dashboard | RepairProof',
      description: 'Private device and repair records.',
      indexable: false,
    };
  if (path.startsWith('/technician/'))
    return {
      title: 'Technician workspace | RepairProof',
      description: 'Private technician repair workspace.',
      indexable: false,
    };
  if (path.startsWith('/shop/'))
    return {
      title: 'Shop workspace | RepairProof',
      description: 'Private repair organization workspace.',
      indexable: false,
    };
  if (path.startsWith('/admin/'))
    return {
      title: 'Administration | RepairProof',
      description: 'Private RepairProof administration.',
      indexable: false,
    };
  if (path.startsWith('/legacy/'))
    return {
      title: 'RepairProof workspace',
      description: 'Private legacy workspace route.',
      indexable: false,
    };
  return { title: 'RepairProof', description: homeDescription, indexable: false };
}

function configuredPublicOrigin() {
  try {
    const configuredOrigin =
      import.meta.env.VITE_APP_URL ||
      (import.meta.env.VITE_VERCEL_ENV === 'production' &&
      import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL}`
        : '');
    const url = new URL(configuredOrigin);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.invalid') ||
      host.endsWith('.example') ||
      host === 'example.com' ||
      host === 'example.org' ||
      host.endsWith('.example.org') ||
      host.endsWith('.test')
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

function setMeta(name: string, value: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(property ? 'property' : 'name', name);
    document.head.append(element);
  }
  element.content = value;
}

function SeoMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = seoForPath(pathname);
    const origin = configuredPublicOrigin();
    document.title = meta.title;
    setMeta('description', meta.description);
    setMeta('robots', meta.indexable && origin ? 'index, follow' : 'noindex, nofollow');
    setMeta('og:title', meta.title, true);
    setMeta('og:description', meta.description, true);
    setMeta('og:type', 'website', true);
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', meta.title);
    setMeta('twitter:description', meta.description);

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (meta.indexable && origin) {
      const link = canonical ?? document.createElement('link');
      link.rel = 'canonical';
      link.href = `${origin}/`;
      if (!canonical) document.head.append(link);
      setMeta('og:url', `${origin}/`, true);
      const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: 'RepairProof',
            url: `${origin}/`,
            description: homeDescription,
          },
          {
            '@type': 'SoftwareApplication',
            name: 'RepairProof',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: `${origin}/`,
            description: homeDescription,
          },
        ],
      };
      let jsonLd = document.getElementById('repairproof-seo-jsonld');
      if (!jsonLd) {
        jsonLd = document.createElement('script');
        jsonLd.id = 'repairproof-seo-jsonld';
        jsonLd.setAttribute('type', 'application/ld+json');
        document.head.append(jsonLd);
      }
      jsonLd.textContent = JSON.stringify(structuredData);
    } else {
      canonical?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
      document.getElementById('repairproof-seo-jsonld')?.remove();
    }
  }, [pathname]);
  return null;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspended>
        <LandingPage />
      </Suspended>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/consumer/login',
    element: (
      <Suspended>
        <AccountAccessPage />
      </Suspended>
    ),
  },
  {
    path: '/consumer/register',
    element: (
      <Suspended>
        <AccountAccessPage />
      </Suspended>
    ),
  },
  {
    path: '/consumer/*',
    element: (
      <Suspended>
        <ConsumerLayout />
      </Suspended>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/technician/*',
    element: (
      <Suspended>
        <TechnicianLayout />
      </Suspended>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/shop/*',
    element: (
      <Suspended>
        <ShopAdminLayout />
      </Suspended>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/admin/*',
    element: (
      <Suspended>
        <PlatformAdminLayout />
      </Suspended>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/authorize/:token',
    element: (
      <Suspended>
        <PublicScreens type="authorization" />
      </Suspended>
    ),
  },
  {
    path: '/verify',
    element: (
      <Suspended>
        <PublicScreens type="verification" />
      </Suspended>
    ),
  },
  {
    path: '/verify/:certificateNumber',
    element: (
      <Suspended>
        <PublicScreens type="verification" />
      </Suspended>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspended>
        <AccountAccessPage />
      </Suspended>
    ),
  },
  {
    path: '/signup',
    element: (
      <Suspended>
        <AccountAccessPage />
      </Suspended>
    ),
  },
  {
    path: '/legacy',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/technician/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Suspended>
            <LegacyScreens type="dashboard" />
          </Suspended>
        ),
      },
      {
        path: 'devices',
        element: (
          <Suspended>
            <LegacyScreens type="devices" />
          </Suspended>
        ),
      },
      {
        path: 'devices/register',
        element: (
          <Suspended>
            <LegacyScreens type="register-device" />
          </Suspended>
        ),
      },
      {
        path: 'cases',
        element: (
          <Suspended>
            <LegacyScreens type="cases" />
          </Suspended>
        ),
      },
      {
        path: 'cases/new',
        element: (
          <Suspended>
            <LegacyScreens type="new-case" />
          </Suspended>
        ),
      },
      {
        path: 'cases/:id',
        element: (
          <Suspended>
            <LegacyScreens type="case-detail" />
          </Suspended>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
