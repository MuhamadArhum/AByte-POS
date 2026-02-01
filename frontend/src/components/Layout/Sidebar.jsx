// =============================================================
// Sidebar.jsx - Navigation Sidebar Component
// Displays the left sidebar with navigation links, user info, and logout button.
// Navigation items are filtered based on the user's role:
//   - Admin sees all links (Dashboard, POS, Products, Inventory, Customers, Reports, Users)
//   - Manager sees all except Users
//   - Cashier sees only Dashboard and POS
// =============================================================

import { NavLink } from 'react-router-dom';      // NavLink adds "active" class to current page link
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiPackage, FiShoppingCart, FiUsers,
  FiBarChart2, FiBox, FiUserCheck, FiLogOut
} from 'react-icons/fi';  // Feather icons from react-icons library

export default function Sidebar() {
  const { user, logout } = useAuth();  // Get current user and logout function

  // Define all navigation items with their route, icon, label, and allowed roles
  const navItems = [
    { to: '/dashboard', icon: <FiHome />, label: 'Dashboard', roles: ['Admin', 'Manager', 'Cashier'] },
    { to: '/pos', icon: <FiShoppingCart />, label: 'POS', roles: ['Admin', 'Manager', 'Cashier'] },
    { to: '/products', icon: <FiPackage />, label: 'Products', roles: ['Admin', 'Manager'] },
    { to: '/inventory', icon: <FiBox />, label: 'Inventory', roles: ['Admin', 'Manager'] },
    { to: '/customers', icon: <FiUserCheck />, label: 'Customers', roles: ['Admin', 'Manager'] },
    { to: '/reports', icon: <FiBarChart2 />, label: 'Reports', roles: ['Admin', 'Manager'] },
    { to: '/users', icon: <FiUsers />, label: 'Users', roles: ['Admin'] },
  ];

  return (
    <aside className="sidebar">
      {/* App logo/name at the top */}
      <div className="sidebar-header">
        <h2>AByte POS</h2>
      </div>

      {/* Navigation links - filtered by user's role */}
      <nav className="sidebar-nav">
        {navItems
          .filter((item) => item.roles.includes(user?.role))  // Only show items this role can access
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}  // Highlight current page
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
      </nav>

      {/* Footer: shows logged-in user name, role, and logout button */}
      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-name">{user?.name}</span>
          <span className="user-role">{user?.role}</span>
        </div>
        <button className="btn-logout" onClick={logout}>
          <FiLogOut /> Logout
        </button>
      </div>
    </aside>
  );
}
