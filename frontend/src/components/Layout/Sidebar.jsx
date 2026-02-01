import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiPackage, FiShoppingCart, FiUsers,
  FiBarChart2, FiBox, FiUserCheck, FiLogOut
} from 'react-icons/fi';

export default function Sidebar() {
  const { user, logout } = useAuth();

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
      <div className="sidebar-header">
        <h2>AByte POS</h2>
      </div>
      <nav className="sidebar-nav">
        {navItems
          .filter((item) => item.roles.includes(user?.role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
      </nav>
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
