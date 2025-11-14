import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  Pill,
  FileText,
  DollarSign,
  MessageSquare,
  User,
  LogOut,
  Activity,
  Bell,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Accueil', href: '/patient/dashboard', icon: Home },
  { name: 'Rendez-vous', href: '/patient/appointments', icon: Calendar },
  { name: 'Ordonnances', href: '/patient/prescriptions', icon: Pill },
  { name: 'Résultats', href: '/patient/results', icon: FileText },
  { name: 'Factures', href: '/patient/bills', icon: DollarSign },
  { name: 'Messages', href: '/patient/messages', icon: MessageSquare },
  { name: 'Profil', href: '/patient/profile', icon: User },
];

export default function PatientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock patient data - would come from auth context
  const patient = {
    firstName: 'Mbuyi',
    lastName: 'Kabongo',
    email: 'mbuyi.kabongo@email.com',
    initials: 'MK'
  };

  const handleLogout = () => {
    // Would clear auth token and redirect
    navigate('/patient/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gradient-to-b from-blue-600 to-blue-500 pt-5 pb-4 overflow-y-auto shadow-xl">
          <div className="flex items-center flex-shrink-0 px-6 mb-8">
            <Activity className="h-10 w-10 text-white" />
            <div className="ml-3">
              <h1 className="text-2xl font-bold text-white">MedFlow</h1>
              <p className="text-xs text-blue-100">Portail Patient</p>
              <p className="text-[10px] text-blue-200 mt-0.5">by Aymane Moumni</p>
            </div>
          </div>

          {/* Patient Info Card */}
          <div className="mx-3 mb-6 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white text-blue-600 text-lg font-bold">
                {patient.initials}
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-white">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-xs text-blue-100">{patient.email}</p>
              </div>
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
                      ? 'bg-blue-700 text-white'
                      : 'text-blue-50 hover:bg-blue-700/50 hover:text-white'
                  } group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200`}
                >
                  <item.icon
                    className={`${
                      isActive ? 'text-white' : 'text-blue-200 group-hover:text-white'
                    } mr-3 flex-shrink-0 h-5 w-5`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex-shrink-0 flex border-t border-blue-700 p-4">
            <button
              onClick={handleLogout}
              className="flex-shrink-0 w-full group flex items-center px-3 py-2 text-sm font-medium text-blue-50 hover:bg-blue-700/50 hover:text-white rounded-lg transition"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'fixed inset-0 z-40' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>

        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-gradient-to-b from-blue-600 to-blue-500">
          <div className="flex items-center justify-between h-16 px-6 bg-blue-700">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-white" />
              <span className="ml-2 text-xl font-bold text-white">MedFlow</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Patient Info Card Mobile */}
          <div className="mx-3 mt-4 mb-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white text-blue-600 text-lg font-bold">
                {patient.initials}
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-white">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-xs text-blue-100">{patient.email}</p>
              </div>
            </div>
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
                      ? 'bg-blue-700 text-white'
                      : 'text-blue-50 hover:bg-blue-700/50 hover:text-white'
                  } group flex items-center px-3 py-3 text-sm font-medium rounded-lg`}
                >
                  <item.icon className="mr-3 flex-shrink-0 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-3 text-sm font-medium text-blue-50 hover:bg-blue-700/50 hover:text-white rounded-lg transition mt-4"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Déconnexion
            </button>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm">
          <button
            className="px-4 text-gray-500 focus:outline-none lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Bonjour, {patient.firstName} 👋
              </h2>
            </div>
            <div className="ml-4 flex items-center space-x-4">
              <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none relative">
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; 2025 MedFlow Clinic - Kinshasa, RDC</p>
            <p className="text-xs mt-1">Développé par <span className="font-semibold text-blue-600">Aymane Moumni</span></p>
            <p className="mt-2">
              Urgence? Appelez le <span className="font-semibold text-red-600">112</span> ou{' '}
              <span className="font-semibold">+243 81 234 5678</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
