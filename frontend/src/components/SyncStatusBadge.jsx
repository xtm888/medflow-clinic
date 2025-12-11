import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, AlertTriangle, Check } from 'lucide-react';
import clinicSyncService from '../services/clinicSyncService';

/**
 * Small badge showing sync status in the header/navbar
 * Clicking opens the SyncProgressModal
 */
export default function SyncStatusBadge({ onClick }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    // Initial load
    setStatus(clinicSyncService.getSyncStatus());

    // Subscribe to changes
    const unsubscribe = clinicSyncService.subscribeSyncStatus(setStatus);

    // Refresh every 30s
    const interval = setInterval(() => {
      setStatus(clinicSyncService.getSyncStatus());
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getStatusInfo = () => {
    if (!status?.lastSyncTime) {
      return {
        icon: AlertTriangle,
        color: 'text-orange-500 bg-orange-100',
        label: 'Non synchronisé'
      };
    }
    if (status.syncInProgress) {
      return {
        icon: RefreshCw,
        color: 'text-blue-500 bg-blue-100',
        label: 'Synchronisation...',
        animate: true
      };
    }
    if (status.isStale) {
      return {
        icon: Clock,
        color: 'text-orange-500 bg-orange-100',
        label: 'Obsolète'
      };
    }
    return {
      icon: Check,
      color: 'text-green-500 bg-green-100',
      label: 'À jour'
    };
  };

  const info = getStatusInfo();
  const Icon = info.icon;

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm transition-colors hover:opacity-80 ${info.color}`}
      title={status?.lastSyncTime ? `Dernière sync: ${formatTime(status.lastSyncTime)}` : 'Cliquez pour synchroniser'}
    >
      <Icon className={`h-4 w-4 ${info.animate ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{info.label}</span>
      {status?.lastSyncTime && !status.syncInProgress && (
        <span className="hidden md:inline text-xs opacity-75">
          {formatTime(status.lastSyncTime)}
        </span>
      )}
    </button>
  );
}
