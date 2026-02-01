// =============================================================
// AppLayout.jsx - Main Application Layout
// Renders the sidebar navigation on the left and the page content on the right.
// The <Outlet> component from React Router renders the current child route's component.
// This layout is used for all authenticated pages (Dashboard, POS, Products, etc.)
// =============================================================

import { Outlet } from 'react-router-dom';  // Renders the matched child route
import Sidebar from './Sidebar';              // Navigation sidebar component

export default function AppLayout() {
  return (
    <div className="app-layout">
      {/* Left sidebar with navigation links */}
      <Sidebar />

      {/* Right side - main content area */}
      {/* <Outlet> renders whatever child route is currently matched */}
      {/* e.g., /dashboard renders <Dashboard />, /pos renders <POSInterface /> */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
