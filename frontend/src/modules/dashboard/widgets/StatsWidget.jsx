import { useState, useEffect } from 'react';
import {
  Users, Calendar, FileText, DollarSign,
  TrendingUp, TrendingDown, Minus, Loader2
} from 'lucide-react';
import api from '../../../services/apiConfig';

/**
 * StatsWidget - Display key statistics
 *
 * Reusable widget for showing metrics with trends
 */
export default function StatsWidget({
  title = 'Statistiques',
  stats = [],
  loading: externalLoading,
  className = ''
}) {
  const [data, setData] = useState(stats);
  const [loading, setLoading] = useState(false);

  // Fetch stats if not provided
  useEffect(() => {
    if (stats.length === 0) {
      fetchStats();
    } else {
      setData(stats);
    }
  }, [stats]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard/stats');
      const statsData = response.data?.data || response.data;

      // Transform to widget format
      setData([
        {
          label: 'Patients Total',
          value: statsData?.totalPatients || 0,
          icon: 'Users',
          trend: statsData?.patientsTrend || 0,
          color: 'blue'
        },
        {
          label: 'RDV Aujourd\'hui',
          value: statsData?.todayAppointments || 0,
          icon: 'Calendar',
          trend: statsData?.appointmentsTrend || 0,
          color: 'green'
        },
        {
          label: 'Prescriptions',
          value: statsData?.pendingPrescriptions || 0,
          icon: 'FileText',
          trend: statsData?.prescriptionsTrend || 0,
          color: 'purple'
        },
        {
          label: 'Revenus',
          value: statsData?.revenue || 0,
          icon: 'DollarSign',
          trend: statsData?.revenueTrend || 0,
          color: 'yellow',
          format: 'currency'
        }
      ]);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Icon mapping
  const iconMap = {
    Users,
    Calendar,
    FileText,
    DollarSign
  };

  // Color mapping
  const colorMap = {
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-600',
      icon: 'text-blue-500'
    },
    green: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      icon: 'text-green-500'
    },
    purple: {
      bg: 'bg-purple-100',
      text: 'text-purple-600',
      icon: 'text-purple-500'
    },
    yellow: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-600',
      icon: 'text-yellow-500'
    }
  };

  // Format value
  const formatValue = (value, format) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XAF',
        maximumFractionDigits: 0
      }).format(value);
    }
    return new Intl.NumberFormat('fr-FR').format(value);
  };

  // Render trend indicator
  const renderTrend = (trend) => {
    if (!trend) return null;

    if (trend > 0) {
      return (
        <span className="flex items-center text-xs text-green-600">
          <TrendingUp className="w-3 h-3 mr-1" />
          +{trend}%
        </span>
      );
    } else if (trend < 0) {
      return (
        <span className="flex items-center text-xs text-red-600">
          <TrendingDown className="w-3 h-3 mr-1" />
          {trend}%
        </span>
      );
    }
    return (
      <span className="flex items-center text-xs text-gray-500">
        <Minus className="w-3 h-3 mr-1" />
        0%
      </span>
    );
  };

  const isLoading = externalLoading !== undefined ? externalLoading : loading;

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {data.map((stat, index) => {
          const Icon = iconMap[stat.icon] || Users;
          const colors = colorMap[stat.color] || colorMap.blue;

          return (
            <div key={index} className="text-center">
              <div className={`inline-flex p-3 rounded-full ${colors.bg} mb-2`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(stat.value, stat.format)}
              </div>
              <div className="text-sm text-gray-500 mb-1">{stat.label}</div>
              {renderTrend(stat.trend)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
