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
  Scissors,
  Bell,
  Shield,
  Building2,
  ShieldCheck,
  Home,
  LayoutGrid,
  Package,
  Glasses,
  Circle,
  Download
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePatient } from '../contexts/PatientContext';
import { useClinic } from '../contexts/ClinicContext';
import { getAccessibleMenuItems, menuConfigurations } from '../config/rolePermissions';
import NotificationBell from '../components/NotificationBell';
import OfflineIndicator from '../components/OfflineIndicator';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import SyncProgressModal from '../components/SyncProgressModal';
import PrepareOfflineModal from '../components/PrepareOfflineModal';
import ClinicSelector from '../components/ClinicSelector';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import GlobalSearch from '../components/GlobalSearch';
import SessionTimeoutWarning from '../components/SessionTimeoutWarning';
// QuickActionsFAB removed - was overlapping with bottom nav
import { PatientSelector } from '../modules/patient';
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
  Scissors,
  Bell,
  Shield,
  Building2,
  ShieldCheck,
  Package,
  Glasses,
  Circle
};

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [showPrepareOffline, setShowPrepareOffline] = useState(false);
  const { user, logout } = useAuth();
  const { hasPatient } = usePatient();
  const { showSyncProgress, closeSyncProgress, openSyncProgress } = useClinic();

  // Helper function to check if a menu path is active (handles query params)
  const isPathActive = (menuPath) => {
    if (!menuPath) return false;

    // Parse the menu path to extract pathname and search params
    const [menuPathname, menuSearch] = menuPath.split('?');

    // First check: pathname must match
    if (location.pathname !== menuPathname) return false;

    // If menu path has no query params, pathname match is enough
    if (!menuSearch) return true;

    // If menu path has query params, check if they're present in current location
    const menuParams = new URLSearchParams(menuSearch);
    const currentParams = new URLSearchParams(location.search);

    // Check if all menu params are present in current URL
    for (const [key, value] of menuParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

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

    // Use menuItems from database instead of hardcoded config
    const accessibleItems = user.menuItems || getAccessibleMenuItems(user.role);
    const menusToExpand = {};

    accessibleItems.forEach(itemKey => {
      const config = menuConfigurations[itemKey];
      if (config?.subItems?.length > 0) {
        const hasActiveSubItem = config.subItems.some(sub => isPathActive(sub.path));
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
    // Navigation shortcuts (all require modifier keys to prevent accidental triggers)
    'ctrl+h': () => navigate('/home'),
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

    // Use menuItems from database (loaded during login) instead of hardcoded config
    const accessibleItems = user.menuItems || getAccessibleMenuItems(user.role);

    const navItems = accessibleItems.map(itemKey => {
      const config = menuConfigurations[itemKey];
      if (!config) {
        console.warn(`⚠️ No config found for menu item: ${itemKey}`);
        return null;
      }

      const IconComponent = iconMap[config.icon] || Activity;

      // Handle items with submenus
      if (config.subItems && config.subItems.length > 0) {
        // Filter subItems based on user role
        const filteredSubItems = config.subItems
          .filter(sub => !sub.roles || sub.roles.includes(user.role))
          .map(sub => ({
            name: sub.label,
            href: sub.path,
            icon: iconMap[sub.icon] || Activity
          }));

        // Only show parent menu if there are visible subItems
        if (filteredSubItems.length === 0) {
          return null;
        }

        return {
          name: config.label,
          href: config.path,
          icon: IconComponent,
          description: config.description,
          key: itemKey,
          subItems: filteredSubItems
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
      admin: 'Administrateur',
      doctor: 'Médecin',
      ophthalmologist: 'Ophtalmologiste',
      nurse: 'Infirmier(ère)',
      receptionist: 'Réceptionniste',
      pharmacist: 'Pharmacien(ne)',
      lab_technician: 'Technicien Labo',
      accountant: 'Comptable',
      manager: 'Responsable',
      technician: 'Technicien',
      orthoptist: 'Orthoptiste',
      optometrist: 'Optométriste',
      radiologist: 'Radiologue',
      imaging_tech: 'Technicien Imagerie'
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
              <p className="text-xs text-primary-200">Système de Gestion Médicale</p>
              <p className="text-[10px] text-primary-300 mt-0.5">par Aymane Moumni</p>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = item.href && isPathActive(item.href);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedMenus[item.key];
              const isSubItemActive = hasSubItems && item.subItems.some(sub => isPathActive(sub.href));

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
                          const isSubActive = isPathActive(subItem.href);
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
              Déconnexion
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
              const isActive = item.href && isPathActive(item.href);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedMenus[item.key];
              const isSubItemActive = hasSubItems && item.subItems.some(sub => isPathActive(sub.href));

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
                          const isSubActive = isPathActive(subItem.href);
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
              Déconnexion
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
            <div className="flex items-center gap-3">
              {/* Home Dashboard Button */}
              <button
                onClick={() => navigate('/home')}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-sm hover:shadow-md"
                title="Accueil - Menu principal (Ctrl+H)"
              >
                <LayoutGrid className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Accueil</span>
              </button>
              <div className="flex-1 max-w-xl">
                <PatientSelector mode="search" className="w-full" />
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-3">
              <ClinicSelector />
              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
              {/* Prepare Offline Button */}
              <button
                onClick={() => setShowPrepareOffline(true)}
                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Préparer pour le mode hors ligne"
              >
                <Download className="h-5 w-5" />
              </button>
              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
              <SyncStatusIndicator onOpenDetails={openSyncProgress} />
              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
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
                  title="Déconnexion"
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

      {/* Session Timeout Warning */}
      <SessionTimeoutWarning />

      {/* Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showSyncProgress}
        onClose={closeSyncProgress}
      />

      {/* Prepare Offline Modal */}
      <PrepareOfflineModal
        isOpen={showPrepareOffline}
        onClose={() => setShowPrepareOffline(false)}
      />
    </div>
  );
}
