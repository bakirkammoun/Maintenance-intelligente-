import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Bell,
  ClipboardList,
  Search,
  Sun,
  Moon,
  LogOut,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Monitor
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import api from '../services/api';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const searchRef = React.useRef(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
  };

  React.useEffect(() => {
    fetchInitialCount();

    const unsubscribe = subscribe('alert', (payload) => {
      // Pulse animation for ANY alert activity (even updates)
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);

      // Only increment for genuinely new alerts or escalations (handled by backend isNew flag)
      if (payload.isNew) {
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [subscribe]);

  const fetchInitialCount = async () => {
    try {
      const response = await api.get('/dashboard/overview');
      if (response.data && response.data.openAlerts !== undefined) {
        setUnreadCount(response.data.openAlerts);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du nombre d\'alertes:', error);
    }
  };

  // Search Logic
  React.useEffect(() => {
    const handleSearch = async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const response = await api.get('/devices');
          const devices = response.data;
          const filtered = devices.filter(d =>
            d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.deviceId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.location?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(filtered.slice(0, 5));
          setShowSearchDropdown(true);
        } catch (error) {
          console.error("Search failed", error);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    };

    const timeout = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Hide search dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = () => {
    setUnreadCount(0);
    navigate('/alerts');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/devices', label: 'Machines', icon: <Monitor size={20} /> },
    { path: '/alerts', label: 'Alertes', icon: <Bell size={20} /> },
    { path: '/config', label: 'Configuration', icon: <Settings size={20} /> },
    { path: '/logs', label: 'Logs', icon: <ClipboardList size={20} /> },
  ];

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-logo">
              <Cpu size={28} color="#422afb" fill="#422afb" fillOpacity={0.2} />
            </span>
            {sidebarOpen && <h2>Maintenance</h2>}
          </div>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''
                }`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <span className="nav-icon"><LogOut size={20} /></span>
            {sidebarOpen && <span className="nav-label">Déconnexion</span>}
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="navbar">
          <div className="navbar-left">
            <button
              className="navbar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <div className="search-bar" ref={searchRef}>
              <span className="search-icon"><Search size={18} /></span>
              <input
                type="text"
                placeholder="Rechercher une machine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length > 1 && setShowSearchDropdown(true)}
              />
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="search-dropdown">
                  {searchResults.map(device => (
                    <div
                      key={device.deviceId}
                      className="search-result-item"
                      onClick={() => {
                        navigate(`/devices/${device.deviceId}`);
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="result-info">
                        <span className="result-name">{device.name}</span>
                        <span className="result-id">#{device.deviceId}</span>
                      </div>
                      <span className="result-location">{device.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="navbar-center">
            <div className="status-badge">
              <span className="status-label">Aujourd'hui</span>
              <span className="status-count">
                {new Date().toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="navbar-right">
            <div className="theme-toggle">
              <span
                className={`toggle-icon ${theme === 'light' ? 'active' : ''}`}
                onClick={() => toggleTheme('light')}
              >
                <Sun size={16} />
              </span>
              <span
                className={`toggle-icon ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => toggleTheme('dark')}
              >
                <Moon size={16} />
              </span>
            </div>
            <div className="nav-icons">
              <button
                className={`icon-btn ${pulse ? 'alert-pulse' : ''}`}
                title="Notifications"
                onClick={handleNotificationClick}
                style={{ position: 'relative' }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className={`notification-badge ${pulse ? 'pulse' : ''}`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
            <div className="user-profile">
              <div className="user-text">
                <span className="user-name">{user?.username || 'Robert Brown'}</span>
                <span className="user-role">{user?.role || 'Manager'}</span>
              </div>
              <div className="user-avatar-wrapper">
                <div className="user-avatar">
                  {user?.avatar ? <img src={user.avatar} alt="User" /> : 'RB'}
                </div>
                <span className="status-dot online"></span>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div >
    </div >
  );
};

export default Layout;
