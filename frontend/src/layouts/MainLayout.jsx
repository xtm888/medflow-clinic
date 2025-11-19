import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  Pill,
  FileText,
  Image,
  DollarSign,
  Receipt,
  Stethoscope,
  Settings,
  Menu,
  X,
  Activity,
  Eye,
  Briefcase,
  LogOut,
  HardDrive,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  BarChart3,
  Syringe,
  Bell
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePatient } from '../contexts/PatientContext';
import { getAccessibleMenuItems, menuConfigurations } from '../config/rolePermissions';
import NotificationBell from '../components/NotificationBell';
import OfflineIndicator from '../components/OfflineIndicator';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import GlobalSearch from '../components/GlobalSearch';
import QuickActionsFAB from '../components/QuickActionsFAB';
import PatientQuickSearch from '../components/PatientQuickSearch';
import PatientContextPanel from '../components/PatientContextPanel';
// GlobalActionBar removed - using context-aware actions in PatientDetail instead
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

const iconMap = {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  Pill,
  FileText,
  Image,
  DollarSign,
  Receipt,
  Stethoscope,
  Settings,
  Eye,
  Briefcase,
  HardDrive,
  FlaskConical,
  BarChart3,
  Syringe,
  Bell
};

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const { user, logout } = useAuth();
  const { hasPatient } = usePatient();

  // Toggle submenu expansion
  const toggleSubmenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  // Auto-expand menus when their sub-items are active
  useEffect(() => {
    if (!user) return;

    const accessibleItems = getAccessibleMenuItems(user.role);
    const menusToExpand = {};

    accessibleItems.forEach(itemKey => {
      const config = menuConfigurations[itemKey];
      if (config?.subItems?.length > 0) {
        const hasActiveSubItem = config.subItems.some(sub => location.pathname === sub.path);
        if (hasActiveSubItem) {
          menusToExpand[itemKey] = true;
        }
      }
    });

    if (Object.keys(menusToExpand).length > 0) {
      setExpandedMenus(prev => ({
        ...prev,
        ...menusToExpand
      }));
    }
  }, [location.pathname, user]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    // Navigation shortcuts
    'ctrl+h': () => navigate('/dashboard'),
    'ctrl+p': () => navigate('/patients'),
    'ctrl+q': () => navigate('/queue'),
    'ctrl+a': () => navigate('/appointments'),

    // Search shortcuts
    'ctrl+f': () => setShowGlobalSearch(true),
    'ctrl+k': () => setShowGlobalSearch(true),

    // Help shortcuts
    'f1': () => setShowShortcutsHelp(true),
    '?': () => setShowShortcutsHelp(true),
    'shift+/': () => setShowShortcutsHelp(true),
  }, true, [navigate]);

  // Get navigation items based on user role
  const navigation = useMemo(() => {
    if (!user) return [];

    const accessibleItems = getAccessibleMenuItems(user.role);
    console.log('👤 User role:', user.role);
    console.log('📋 Accessible menu items:', accessibleItems);

    const navItems = accessibleItems.map(itemKey => {
      const config = menuConfigurations[itemKey];
      if (!config) {
        console.warn(`⚠️ No config found for menu item: ${itemKey}`);
        return null;
      }

      const IconComponent = iconMap[config.icon] || Activity;

      // Handle items with submenus
      if (config.subItems && config.subItems.length > 0) {
        return {
          name: config.label,
          href: config.path,
          icon: IconComponent,
          description: config.description,
          key: itemKey,
          subItems: config.subItems.map(sub => ({
            name: sub.label,
            href: sub.path,
            icon: iconMap[sub.icon] || Activity
          }))
        };
      }

      return {
        name: config.label,
        href: config.path,
        icon: IconComponent,
        description: config.description,
        key: itemKey
      };
    }).filter(item => item !== null);

    console.log('🔗 Generated navigation items:', navItems.map(n => n.name));
    return navItems;
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get user display info
  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  };

  const getUserFullName = () => {
    if (!user) return 'User';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User';
  };

  const getRoleDisplay = () => {
    if (!user) return '';
    const roleMap = {
      admin: 'Administrator',
      doctor: 'Doctor',
      ophthalmologist: 'Ophthalmologist',
      nurse: 'Nurse',
      receptionist: 'Receptionist',
      pharmacist: 'Pharmacist',
      lab_technician: 'Lab Technician',
      accountant: 'Accountant'
    };
    return roleMap[user.role] || user.role;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gradient-to-b from-primary-900 to-primary-800 pt-5 pb-4 overflow-y-auto shadow-xl">
          <div className="flex items-center flex-shrink-0 px-6 mb-8">
            <Activity className="h-10 w-10 text-white" />
            <div className="ml-3">
              <h1 className="text-2xl font-bold text-white">MedFlow</h1>
              <p className="text-xs text-primary-200">Medical Management System</p>
              <p className="text-[10px] text-primary-300 mt-0.5">by Aymane Moumni</p>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = item.href && location.pathname === item.href;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedMenus[item.key];
              const isSubItemActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.href);

              if (hasSubItems) {
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleSubmenu(item.key)}
                      className={`${
                        isSubItemActive
                          ? 'bg-primary-700 text-white'
                          : 'text-primary-100 hover:bg-primary-700/50 hover:text-white'
                      } group flex items-center justify-between w-full px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200`}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={`${
                            isSubItemActive ? 'text-white' : 'text-primary-200 group-hover:text-white'
                          } mr-3 flex-shrink-0 h-5 w-5`}
                        />
                        {item.name}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary-200" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-primary-200" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 ml-4 space-y-1">
                        {item.subItems.map((subItem) => {
                          const isSubActive = location.pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              className={`${
                                isSubActive
                                  ? 'bg-primary-600 text-white'
                                  : 'text-primary-200 hover:bg-primary-700/50 hover:text-white'
                              } group flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200`}
                            >
                              <subItem.icon className="mr-3 flex-shrink-0 h-4 w-4" />
                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    isActive
                      ? 'bg-primary-700 text-white'
                      : 'text-primary-100 hover:bg-primary-700/50 hover:text-white'
                  } group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200`}
                >
                  <item.icon
                    className={`${
                      isActive ? 'text-white' : 'text-primary-200 group-hover:text-white'
                    } mr-3 flex-shrink-0 h-5 w-5`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="flex-shrink-0 flex flex-col border-t border-primary-700 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary-700 text-white text-sm font-medium">
                  {getUserInitials()}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-white">{getUserFullName()}</p>
                  <p className="text-xs text-primary-200">{getRoleDisplay()}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center justify-center px-3 py-2 text-sm font-medium text-primary-100 hover:bg-primary-700 hover:text-white rounded-lg transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'fixed inset-0 z-40' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>

        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-gradient-to-b from-primary-900 to-primary-800">
          <div className="flex items-center justify-between h-16 px-6 bg-primary-900">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-white" />
              <span className="ml-2 text-xl font-bold text-white">MedFlow</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = item.href && location.pathname === item.href;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedMenus[item.key];
              const isSubItemActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.href);

              if (hasSubItems) {
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleSubmenu(item.key)}
                      className={`${
                        isSubItemActive
                          ? 'bg-primary-700 text-white'
                          : 'text-primary-100 hover:bg-primary-700/50 hover:text-white'
                      } group flex items-center justify-between w-full px-3 py-3 text-sm font-medium rounded-lg`}
                    >
                      <div className="flex items-center">
                        <item.icon className="mr-3 flex-shrink-0 h-5 w-5" />
                        {item.name}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 ml-4 space-y-1">
                        {item.subItems.map((subItem) => {
                          const isSubActive = location.pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`${
                                isSubActive
                                  ? 'bg-primary-600 text-white'
                                  : 'text-primary-200 hover:bg-primary-700/50 hover:text-white'
                              } group flex items-center px-3 py-2 text-sm rounded-lg`}
                            >
                              <subItem.icon className="mr-3 flex-shrink-0 h-4 w-4" />
                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`${
                    isActive
                      ? 'bg-primary-700 text-white'
                      : 'text-primary-100 hover:bg-primary-700/50 hover:text-white'
                  } group flex items-center px-3 py-3 text-sm font-medium rounded-lg`}
                >
                  <item.icon className="mr-3 flex-shrink-0 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="flex-shrink-0 flex flex-col border-t border-primary-700 p-4">
            <div className="flex items-center mb-3">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary-700 text-white text-sm font-medium">
                {getUserInitials()}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">{getUserFullName()}</p>
                <p className="text-xs text-primary-200">{getRoleDisplay()}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center px-3 py-2 text-sm font-medium text-primary-100 hover:bg-primary-700 hover:text-white rounded-lg transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-1">
        {/* Patient Context Panel - shows when patient is selected */}
        {hasPatient && (
          <div className="hidden lg:block flex-shrink-0">
            <PatientContextPanel />
          </div>
        )}

        <div className="flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm lg:shadow-none">
          <button
            className="px-4 text-gray-500 focus:outline-none lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex max-w-xl">
              <PatientQuickSearch className="w-full" />
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-3">
              <OfflineIndicator />
              <div className="h-6 w-px bg-gray-200"></div>
              <NotificationBell />
              <div className="h-6 w-px bg-gray-200"></div>
              <div className="flex items-center space-x-3">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-700">{getUserFullName()}</p>
                  <p className="text-xs text-gray-500">{getRoleDisplay()}</p>
                </div>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary-600 text-white text-sm font-medium">
                  {getUserInitials()}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Global Search */}
      <GlobalSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
      />

      {/* Quick Actions FAB */}
      <QuickActionsFAB />
    </div>
  );
}
