import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CalendarDays,
  UserRoundCheck,
  Eye,
  Syringe,
  ScanEye,
  Pill,
  FlaskConical,
  ScanLine,
  Receipt,
  BarChart3,
  Settings,
  FileText,
  Building2,
  Bell,
  LogOut,
  Activity,
  TrendingUp,
  LayoutDashboard,
  ClipboardList,
  HardDrive,
  DollarSign,
  CheckSquare,
  Briefcase,
  Shield,
  Glasses,
  Circle,
  TestTube,
  ArrowRightLeft,
  Wifi,
  Scissors,
  AlertTriangle,
  PieChart,
  ScanText,
  ClipboardCheck,
  Clipboard,
  HeartPulse,
  FileCode,
  MonitorCheck,
  Globe,
  FileBarChart,
  UserCheck,
  ArrowLeft,
  Home,
  Stethoscope,
  Cog,
  Package,
  Building,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PermissionGate from '../components/PermissionGate';
import dashboardService from '../services/dashboardService';

/**
 * HomeDashboard - Category-based navigation with drill-down
 * Shows 8 category cards, click to see that category's tiles
 */
export default function HomeDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    queueCount: 0,
    todayConsultations: 0,
    monthlyVisits: 0,
    pendingPrescriptions: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch live stats from dashboard API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await dashboardService.getStats();
        const data = response?.data || response;
        setStats({
          todayAppointments: data.todayPatients || 0,
          queueCount: data.waitingNow || 0,
          todayConsultations: data.todayConsultations || 0,
          monthlyVisits: data.monthlyVisits || 0,
          pendingPrescriptions: data.pendingPrescriptions || 0
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Categories with their items
  const categories = [
    {
      id: 'accueil',
      name: 'Accueil',
      icon: Home,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-700',
      items: [
        { id: 'dashboard', title: 'Tableau de bord', icon: LayoutDashboard, path: '/dashboard', permission: 'view_dashboard' },
        { id: 'patients', title: 'Patients', icon: Users, path: '/patients', permission: 'view_patients' },
        { id: 'queue', title: "File d'attente", icon: UserRoundCheck, path: '/queue', permission: 'manage_queue', badge: stats.queueCount },
        { id: 'appointments', title: 'Rendez-vous', icon: CalendarDays, path: '/appointments', permission: 'manage_appointments' },
        { id: 'visits', title: 'Visites', icon: ClipboardList, path: '/visits', permission: 'view_patients' },
        { id: 'alerts', title: 'Alertes', icon: AlertTriangle, path: '/alerts', permission: 'view_notifications' },
        { id: 'queue-analytics', title: 'Analytique File', icon: PieChart, path: '/queue/analytics', permission: 'view_reports' }
      ]
    },
    {
      id: 'clinique',
      name: 'Clinique',
      icon: Stethoscope,
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-700',
      items: [
        { id: 'ophthalmology', title: 'Ophtalmologie', icon: Eye, path: '/ophthalmology', permission: 'perform_eye_exams' },
        { id: 'prescriptions', title: 'Ordonnances', icon: ClipboardList, path: '/prescriptions', permission: 'view_prescriptions', badge: stats.pendingPrescriptions },
        { id: 'pharmacy', title: 'Pharmacie', icon: Pill, path: '/pharmacy', permission: 'dispense_medications' },
        { id: 'laboratory', title: 'Laboratoire', icon: FlaskConical, path: '/laboratory', permission: 'view_lab_orders' },
        { id: 'imaging', title: 'Imagerie', icon: ScanLine, path: '/imaging', permission: 'view_imaging' },
        { id: 'orthoptic', title: 'Orthoptie', icon: ScanEye, path: '/orthoptic', permission: 'perform_orthoptic_exams' },
        { id: 'ivt', title: 'IVT', icon: Syringe, path: '/ivt', permission: 'manage_medical_records' },
        { id: 'surgery', title: 'Chirurgie', icon: Scissors, path: '/surgery', permission: 'manage_medical_records' },
        { id: 'devices', title: 'Appareils', icon: HardDrive, path: '/devices', permission: 'manage_devices' },
        { id: 'devices-status', title: 'État Appareils', icon: MonitorCheck, path: '/devices/status', permission: 'manage_devices' },
        { id: 'network-discovery', title: 'Découverte Réseau', icon: Wifi, path: '/devices/discovery', permission: 'manage_devices' }
      ]
    },
    {
      id: 'workflows',
      name: 'Postes de Travail',
      icon: Cog,
      color: 'rose',
      gradient: 'from-rose-500 to-rose-700',
      items: [
        { id: 'prescription-queue', title: 'File Ordonnances', icon: ClipboardCheck, path: '/prescription-queue', permission: 'verify_prescriptions' },
        { id: 'lab-checkin', title: 'Check-in Labo', icon: UserCheck, path: '/lab-checkin', permission: 'view_lab_orders' },
        { id: 'lab-worklist', title: 'Labo Worklist', icon: Clipboard, path: '/lab-worklist', permission: 'view_lab_orders' },
        { id: 'nurse-vitals', title: 'Saisie Constantes', icon: HeartPulse, path: '/nurse-vitals', permission: 'update_vitals' },
        { id: 'ocr-import', title: 'Import OCR', icon: ScanText, path: '/ocr/import', permission: 'manage_patients' },
        { id: 'ocr-review', title: 'Révision OCR', icon: FileText, path: '/ocr/review', permission: 'manage_patients' },
        { id: 'templates', title: 'Modèles', icon: FileCode, path: '/templates', permission: 'manage_settings' }
      ]
    },
    {
      id: 'optique',
      name: 'Optique & Vente',
      icon: Glasses,
      color: 'cyan',
      gradient: 'from-cyan-500 to-cyan-700',
      items: [
        { id: 'optical-shop', title: 'Boutique Optique', icon: Glasses, path: '/optical-shop', permission: 'view_patients' },
        { id: 'glasses-orders', title: 'Commandes Lunettes', icon: ClipboardList, path: '/glasses-orders', permission: 'view_patients' },
        { id: 'frames', title: 'Stock Montures', icon: Glasses, path: '/frame-inventory', permission: 'view_patients' },
        { id: 'optical-lenses', title: 'Stock Verres', icon: Eye, path: '/optical-lens-inventory', permission: 'view_patients' },
        { id: 'contact-lenses', title: 'Stock Lentilles', icon: Circle, path: '/contact-lens-inventory', permission: 'view_patients' }
      ]
    },
    {
      id: 'labo',
      name: 'Inventaire Labo',
      icon: TestTube,
      color: 'teal',
      gradient: 'from-teal-500 to-teal-700',
      items: [
        { id: 'reagents', title: 'Réactifs', icon: FlaskConical, path: '/reagent-inventory', permission: 'view_lab_orders' },
        { id: 'consumables', title: 'Consommables', icon: TestTube, path: '/lab-consumable-inventory', permission: 'view_lab_orders' }
      ]
    },
    {
      id: 'multisite',
      name: 'Multi-Sites',
      icon: Globe,
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-700',
      items: [
        { id: 'cross-clinic', title: 'Stock Multi-Sites', icon: ArrowRightLeft, path: '/cross-clinic-inventory', permission: 'manage_inventory' },
        { id: 'cross-clinic-dashboard', title: 'Dashboard Multi-Sites', icon: Globe, path: '/cross-clinic-dashboard', permission: 'view_reports' },
        { id: 'consolidated-reports', title: 'Rapports Consolidés', icon: FileBarChart, path: '/consolidated-reports', permission: 'view_reports' }
      ]
    },
    {
      id: 'finances',
      name: 'Finances',
      icon: DollarSign,
      color: 'amber',
      gradient: 'from-amber-500 to-amber-700',
      items: [
        { id: 'invoicing', title: 'Facturation', icon: Receipt, path: '/invoicing', permission: 'create_invoices' },
        { id: 'financial', title: 'Rapports Financiers', icon: DollarSign, path: '/financial', permission: 'view_financial_reports' },
        { id: 'companies', title: 'Conventions', icon: Building2, path: '/companies', permission: 'view_financial_reports' },
        { id: 'approvals', title: 'Approbations', icon: CheckSquare, path: '/approvals', permission: 'manage_approvals' },
        { id: 'services', title: 'Services', icon: Briefcase, path: '/services', permission: 'manage_settings' }
      ]
    },
    {
      id: 'admin',
      name: 'Administration',
      icon: Settings,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-700',
      items: [
        { id: 'settings', title: 'Paramètres', icon: Settings, path: '/settings', permission: 'manage_settings' },
        { id: 'analytics', title: 'Statistiques', icon: BarChart3, path: '/analytics', permission: 'view_reports' },
        { id: 'audit', title: "Journal d'audit", icon: Shield, path: '/audit', permission: 'view_audit_logs' },
        { id: 'documents', title: 'Documents', icon: FileText, path: '/documents', permission: 'view_patients' },
        { id: 'notifications', title: 'Notifications', icon: Bell, path: '/notifications', permission: 'view_notifications' }
      ]
    }
  ];

  // Color mappings for tiles
  const tileColors = {
    blue: 'bg-blue-600 hover:bg-blue-500',
    emerald: 'bg-emerald-600 hover:bg-emerald-500',
    rose: 'bg-rose-600 hover:bg-rose-500',
    cyan: 'bg-cyan-600 hover:bg-cyan-500',
    teal: 'bg-teal-600 hover:bg-teal-500',
    indigo: 'bg-indigo-600 hover:bg-indigo-500',
    amber: 'bg-amber-600 hover:bg-amber-500',
    purple: 'bg-purple-600 hover:bg-purple-500'
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get total badge count for a category
  const getCategoryBadge = (category) => {
    return category.items.reduce((sum, item) => sum + (item.badge || 0), 0);
  };

  // Render category cards view
  const renderCategories = () => (
    <div className="h-full flex flex-col">
      {/* Welcome message */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">
          Bienvenue, {user?.firstName || 'Docteur'}
        </h2>
        <p className="text-slate-400 text-sm">Sélectionnez une catégorie pour commencer</p>
      </div>

      {/* Category Grid */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto w-full">
        {categories.map((category) => {
          const Icon = category.icon;
          const badge = getCategoryBadge(category);

          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`
                relative flex flex-col items-center justify-center
                p-6 rounded-2xl
                bg-gradient-to-br ${category.gradient}
                text-white text-center
                transition-all duration-200
                hover:scale-105 hover:shadow-2xl
                active:scale-95
                shadow-lg
                group
              `}
            >
              {/* Badge */}
              {badge > 0 && (
                <div className="absolute -top-2 -right-2 min-w-[24px] h-6 px-2 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-xs font-bold text-white">{badge}</span>
                </div>
              )}

              <Icon className="h-10 w-10 mb-3" strokeWidth={1.5} />
              <span className="text-base font-semibold mb-1">{category.name}</span>
              <span className="text-xs opacity-75">{category.items.length} modules</span>

              {/* Hover arrow */}
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 opacity-0 group-hover:opacity-75 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );

  // Render selected category's tiles
  const renderCategoryTiles = () => {
    const category = categories.find(c => c.id === selectedCategory);
    if (!category) return null;

    const Icon = category.icon;

    return (
      <div className="h-full flex flex-col">
        {/* Category Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${category.gradient}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{category.name}</h2>
            <p className="text-sm text-slate-400">{category.items.length} modules disponibles</p>
          </div>
        </div>

        {/* Tiles Grid - Large tiles */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
          {category.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <PermissionGate key={item.id} permission={item.permission} fallback={null}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`
                    relative flex flex-col items-center justify-center
                    p-6 sm:p-8 rounded-2xl ${tileColors[category.color]}
                    text-white text-center
                    transition-all duration-150
                    hover:scale-105 hover:shadow-2xl
                    active:scale-95
                    shadow-lg
                    min-h-[120px] sm:min-h-[140px]
                  `}
                >
                  {/* Badge */}
                  {item.badge > 0 && (
                    <div className="absolute -top-2 -right-2 min-w-[24px] h-6 px-2 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-white">{item.badge}</span>
                    </div>
                  )}

                  <ItemIcon className="h-10 w-10 sm:h-12 sm:w-12 mb-3" strokeWidth={1.5} />
                  <span className="text-base sm:text-lg font-semibold leading-tight">{item.title}</span>
                </button>
              </PermissionGate>
            );
          })}
        </div>

        {/* Back hint */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Retour aux catégories
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Compact Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 flex-shrink-0">
        <div className="px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white hidden sm:block">MedFlow</span>
          </div>

          {/* Stats in header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded text-blue-300 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="font-semibold">{loading ? '-' : stats.todayAppointments}</span>
              <span className="hidden sm:inline text-blue-400">RDV</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded text-amber-300 text-xs">
              <UserRoundCheck className="h-3.5 w-3.5" />
              <span className="font-semibold">{loading ? '-' : stats.queueCount}</span>
              <span className="hidden sm:inline text-amber-400">attente</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 text-xs hidden md:flex">
              <Activity className="h-3.5 w-3.5" />
              <span className="font-semibold">{loading ? '-' : stats.todayConsultations}</span>
              <span className="hidden lg:inline text-emerald-400">consultations</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded text-purple-300 text-xs hidden lg:flex">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-semibold">{loading ? '-' : stats.monthlyVisits}</span>
              <span className="text-purple-400">ce mois</span>
            </div>
          </div>

          {/* User & Logout */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-800/50">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <span className="text-sm text-white hidden sm:block">{user?.firstName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto h-full">
          {selectedCategory ? renderCategoryTiles() : renderCategories()}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-2 border-t border-slate-700/50 bg-slate-900/50 text-center">
        <span className="text-xs text-slate-500">MedFlow v2.0 - Système de gestion ophtalmologique</span>
      </footer>
    </div>
  );
}
