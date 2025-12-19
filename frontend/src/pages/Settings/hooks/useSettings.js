/**
 * useSettings Hook
 *
 * Manages settings page state and save handlers.
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import settingsService from '../../../services/settingsService';
import {
  getDefaultProfile,
  getDefaultClinic,
  getDefaultNotifications,
  getDefaultTwilio,
  getDefaultPasswordData
} from '../constants';

export default function useSettings() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [profile, setProfile] = useState(getDefaultProfile());
  const [clinic, setClinic] = useState(getDefaultClinic());
  const [notifications, setNotifications] = useState(getDefaultNotifications());
  const [twilio, setTwilio] = useState(getDefaultTwilio());
  const [passwordData, setPasswordData] = useState(getDefaultPasswordData());

  // Role checks
  const isAdmin = user?.role === 'admin';
  const canManageBilling = ['admin', 'accountant'].includes(user?.role);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [profileRes, settingsRes] = await Promise.all([
        settingsService.getProfile(),
        settingsService.getSettings()
      ]);

      if (profileRes.data) {
        setProfile({
          firstName: profileRes.data.firstName || '',
          lastName: profileRes.data.lastName || '',
          email: profileRes.data.email || '',
          phoneNumber: profileRes.data.phoneNumber || '',
          specialization: profileRes.data.specialization || ''
        });
      }

      if (settingsRes.data) {
        setClinic(settingsRes.data.clinic || getDefaultClinic());
        setNotifications(settingsRes.data.notifications || getDefaultNotifications());
        setTwilio({
          accountSid: settingsRes.data.twilio?.accountSid || '',
          authToken: settingsRes.data.twilio?.authToken || '',
          smsNumber: settingsRes.data.twilio?.smsNumber || '',
          whatsappNumber: settingsRes.data.twilio?.whatsappNumber || ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await settingsService.updateProfile(profile);
      toast.success('Profil mis à jour avec succès');

      localStorage.setItem('user', JSON.stringify({
        ...user,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email
      }));
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde du profil');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClinic = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({ clinic });
      toast.success('Informations de la clinique mises à jour');
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({ notifications });
      toast.success('Préférences de notification mises à jour');
    } catch (error) {
      console.error('Error saving notifications:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTwilio = async () => {
    try {
      setSaving(true);
      await settingsService.updateTwilioSettings(twilio);
      toast.success('Configuration Twilio mise à jour');
    } catch (error) {
      console.error('Error saving Twilio settings:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTwilio = async () => {
    try {
      setSaving(true);
      await settingsService.testTwilioConnection();
      toast.success('Connexion Twilio réussie');
    } catch (error) {
      console.error('Error testing Twilio:', error);
      toast.error(error.response?.data?.error || 'Erreur de connexion Twilio');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      setSaving(true);
      await settingsService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success('Mot de passe modifié avec succès');
      setPasswordData(getDefaultPasswordData());
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadPhoto = async (file) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La taille du fichier ne doit pas dépasser 2MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('photo', file);
      await settingsService.uploadProfilePhoto(formData);
      toast.success('Photo de profil mise à jour');
    } catch (err) {
      toast.error('Erreur lors du téléchargement de la photo');
    }
  };

  return {
    // User
    user,
    isAdmin,
    canManageBilling,

    // Tab state
    activeTab,
    setActiveTab,

    // Loading states
    loading,
    saving,

    // Profile
    profile,
    setProfile,
    handleSaveProfile,
    handleUploadPhoto,

    // Clinic
    clinic,
    setClinic,
    handleSaveClinic,

    // Notifications
    notifications,
    setNotifications,
    handleSaveNotifications,

    // Twilio
    twilio,
    setTwilio,
    handleSaveTwilio,
    handleTestTwilio,

    // Password
    passwordData,
    setPasswordData,
    handleChangePassword
  };
}
