import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto min-h-0 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
