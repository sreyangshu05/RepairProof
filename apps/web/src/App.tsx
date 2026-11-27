import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { PwaStatus } from './pwa/PwaStatus';

export default function App() {
  return (
    <AppProviders>
      <PwaStatus />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
