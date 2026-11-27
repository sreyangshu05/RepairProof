import type { ConsumerDashboardData } from './types';

/** Fictional local fixtures. Use only with VITE_ENABLE_DEMO_FIXTURES=true in development. */
export const consumerDashboardMockData: ConsumerDashboardData = {
  devices: [
    {
      id: 'device-iphone-14-pro',
      manufacturer: 'Apple',
      model: 'iPhone 14 Pro',
      registrationDate: '2024-05-12',
      repairCount: 2,
      warranty: {
        provider: 'Apex Device Lab',
        endsAt: '2026-12-02',
        coverage: 'Display replacement · parts and labor',
      },
      latestRepair: {
        reference: 'RP-2026-01842',
        title: 'Display replacement',
        stage: 'Awaiting approval',
        updatedAt: '2026-11-18T10:15:00Z',
      },
      history: [
        {
          reference: 'RP-2026-01842',
          title: 'Display replacement',
          date: '2026-11-18',
          stage: 'Awaiting approval',
        },
        {
          reference: 'RP-2025-00912',
          title: 'Battery service',
          date: '2025-10-03',
          stage: 'Completed',
        },
      ],
    },
    {
      id: 'device-macbook-air',
      manufacturer: 'Apple',
      model: 'MacBook Air 13-inch',
      registrationDate: '2023-11-04',
      repairCount: 1,
      warranty: {
        provider: 'Apex Device Lab',
        endsAt: '2027-01-14',
        coverage: 'Charging port · repair workmanship',
      },
      latestRepair: {
        reference: 'RP-2026-01798',
        title: 'Charging port service',
        stage: 'In repair',
        updatedAt: '2026-11-17T15:30:00Z',
      },
      history: [
        {
          reference: 'RP-2026-01798',
          title: 'Charging port service',
          date: '2026-11-17',
          stage: 'In repair',
        },
      ],
    },
    {
      id: 'device-galaxy-s23',
      manufacturer: 'Samsung',
      model: 'Galaxy S23',
      registrationDate: '2024-02-21',
      repairCount: 1,
      warranty: null,
      latestRepair: {
        reference: 'RP-2025-01504',
        title: 'Camera module replacement',
        stage: 'Completed',
        updatedAt: '2025-12-09T12:20:00Z',
      },
      history: [
        {
          reference: 'RP-2025-01504',
          title: 'Camera module replacement',
          date: '2025-12-09',
          stage: 'Completed',
        },
      ],
    },
  ],
  notifications: [
    {
      id: 'notification-approval',
      title: 'Estimate ready for review',
      detail: 'iPhone 14 Pro · RP-2026-01842',
      createdAt: '2026-11-18T10:15:00Z',
      href: '/consumer/approval',
      unread: true,
    },
    {
      id: 'notification-warranty',
      title: 'Warranty ending soon',
      detail: 'Display replacement coverage ends December 2.',
      createdAt: '2026-11-16T09:00:00Z',
      href: '/consumer/warranties',
      unread: true,
    },
    {
      id: 'notification-repair',
      title: 'Repair update received',
      detail: 'MacBook Air · Charging port service',
      createdAt: '2026-11-15T14:25:00Z',
      href: '/consumer/case',
      unread: false,
    },
  ],
  activity: [
    {
      id: 'activity-1',
      title: 'Estimate shared',
      detail: 'iPhone 14 Pro · RP-2026-01842',
      createdAt: '2026-11-18T10:15:00Z',
      href: '/consumer/approval',
    },
    {
      id: 'activity-2',
      title: 'Repair work started',
      detail: 'MacBook Air · RP-2026-01798',
      createdAt: '2026-11-17T15:30:00Z',
      href: '/consumer/case',
    },
    {
      id: 'activity-3',
      title: 'Warranty added to record',
      detail: 'iPhone 14 Pro · Battery service',
      createdAt: '2026-11-15T11:10:00Z',
      href: '/consumer/warranties',
    },
    {
      id: 'activity-4',
      title: 'Device registered',
      detail: 'Galaxy S23',
      createdAt: '2024-02-21T08:00:00Z',
      href: '/consumer/device-details',
    },
  ],
};
