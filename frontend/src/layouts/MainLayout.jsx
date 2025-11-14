import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  Pill,
  FileText,
  Image,
  Bell,
  DollarSign,
  Receipt,
  Stethoscope,
  Settings,
  Menu,
  X,
  Activity,
  Eye,
  Briefcase,
  LogOut
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAccessibleMenuItems, menuConfigurations } from '../config/rolePermissions';

const iconMap = {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  Pill,
  FileText,
  Image,
  Bell,
  DollarSign,
  Receipt,
  Stethoscope,
  Settings,
  Eye,
  Briefcase
};

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  // Get navigation items based on user role
  const navigation = useMemo(() => {
    if (!user) return [];

    const accessibleItems = getAccessibleMenuItems(user.role);
    return accessibleItems.map(itemKey => {
      const config = menuConfigurations[itemKey];
      if (!config) return null;

      const IconComponent = iconMap[config.icon] || Activity;
      return {
        name: config.label,
        href: config.path,
        icon: IconComponent,
        description: config.description
      };
    }).filter(item => item !== null);
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
              const isActive = location.pathname === item.href;
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
              const isActive = location.pathname === item.href;
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
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm lg:shadow-none">
          <button
            className="px-4 text-gray-500 focus:outline-none lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <form className="w-full flex md:ml-0" action="#" method="GET">
                <label htmlFor="search-field" className="sr-only">Search</label>
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    id="search-field"
                    className="block w-full h-full pl-10 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent sm:text-sm"
                    placeholder="Search patients, appointments..."
                    type="search"
                  />
                </div>
              </form>
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 relative">
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              </button>
              <div className="h-8 w-px bg-gray-200"></div>
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
  );
}
