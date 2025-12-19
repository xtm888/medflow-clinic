/**
 * Settings Constants
 *
 * Configuration for settings page tabs and options.
 */

import {
  User, Bell, Lock, Database, Globe, DollarSign, Plus,
  Calendar, Server, Shield, UserPlus, Tag
} from 'lucide-react';

// Build tabs array based on user roles
export const buildTabs = (isAdmin, canManageBilling) => {
  const tabs = [
    { id: 'profile', icon: User, label: 'Profil' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'calendar', icon: Calendar, label: 'Calendrier' },
    { id: 'security', icon: Lock, label: 'Sécurité' }
  ];

  if (canManageBilling) {
    tabs.push(
      { id: 'billing', icon: DollarSign, label: 'Facturation' },
      { id: 'tarifs', icon: Tag, label: 'Tarifs' },
      { id: 'referrers', icon: UserPlus, label: 'Référents' }
    );
  }

  if (isAdmin) {
    tabs.push(
      { id: 'clinic', icon: Database, label: 'Clinique' },
      { id: 'permissions', icon: Shield, label: 'Permissions' },
      { id: 'twilio', icon: Globe, label: 'Twilio' },
      { id: 'lis', icon: Server, label: 'LIS/HL7' }
    );
  }

  return tabs;
};

// Notification preferences configuration
export const NOTIFICATION_PREFS = [
  {
    key: 'appointmentReminders',
    label: 'Rappels de rendez-vous',
    description: 'Envoyer des rappels automatiques aux patients'
  },
  {
    key: 'stockAlerts',
    label: 'Alertes de stock',
    description: 'Recevoir des alertes pour les stocks faibles'
  },
  {
    key: 'financialReports',
    label: 'Notifications financières',
    description: 'Rapports quotidiens de revenus'
  },
  {
    key: 'followUpReminders',
    label: 'Rappels de suivi',
    description: 'Notifications pour les revisites patients'
  }
];

// Tax applicable categories
export const TAX_CATEGORIES = [
  { value: 'all', label: 'Toutes les catégories' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'procedure', label: 'Procédure' },
  { value: 'imaging', label: 'Imagerie' },
  { value: 'laboratory', label: 'Laboratoire' },
  { value: 'medication', label: 'Médicaments' },
  { value: 'surgery', label: 'Chirurgie' }
];

// Tax types
export const TAX_TYPES = [
  { value: 'percentage', label: 'Pourcentage (%)' },
  { value: 'fixed', label: 'Montant fixe (CDF)' }
];

// Default states
export const getDefaultProfile = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  specialization: ''
});

export const getDefaultClinic = () => ({
  name: '',
  address: '',
  phone: '',
  email: ''
});

export const getDefaultNotifications = () => ({
  appointmentReminders: true,
  stockAlerts: true,
  financialReports: false,
  followUpReminders: false
});

export const getDefaultTwilio = () => ({
  accountSid: '',
  authToken: '',
  smsNumber: '',
  whatsappNumber: ''
});

export const getDefaultPasswordData = () => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

export const getDefaultTaxForm = () => ({
  name: '',
  code: '',
  rate: '',
  type: 'percentage',
  applicableCategories: ['all'],
  description: '',
  active: true
});

export const getDefaultConfirmModal = () => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'warning',
  onConfirm: null
});
