/**
 * Settings Page - Main Component
 *
 * Orchestrates all settings sections with tabbed navigation.
 */

import { Loader2 } from 'lucide-react';
import CalendarIntegration from '../../components/settings/CalendarIntegration';
import LISIntegration from '../../components/settings/LISIntegration';
import RolePermissionsManager from '../../components/settings/RolePermissionsManager';
import ReferrerManagement from '../../components/settings/ReferrerManagement';
import TarifManagement from '../../components/settings/TarifManagement';
import ConfirmationModal from '../../components/ConfirmationModal';

import { buildTabs } from './constants';
import { useSettings, useTaxConfiguration } from './hooks';
import {
  SettingsSidebar,
  ProfileSection,
  ClinicSection,
  NotificationsSection,
  SecuritySection,
  TwilioSection,
  BillingSection
} from './components';

export default function Settings() {
  const {
    isAdmin,
    canManageBilling,
    activeTab,
    setActiveTab,
    loading,
    saving,
    profile,
    setProfile,
    handleSaveProfile,
    handleUploadPhoto,
    clinic,
    setClinic,
    handleSaveClinic,
    notifications,
    setNotifications,
    handleSaveNotifications,
    twilio,
    setTwilio,
    handleSaveTwilio,
    handleTestTwilio,
    passwordData,
    setPasswordData,
    handleChangePassword
  } = useSettings();

  const {
    taxes,
    taxesLoading,
    showTaxModal,
    editingTax,
    taxForm,
    setTaxForm,
    saving: taxSaving,
    handleOpenTaxModal,
    handleCloseTaxModal,
    handleSaveTax,
    handleDeleteTax,
    confirmModal,
    closeConfirmModal
  } = useTaxConfiguration(activeTab, canManageBilling);

  const tabs = buildTabs(isAdmin, canManageBilling);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configuration du système et préférences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <SettingsSidebar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          {activeTab === 'profile' && (
            <ProfileSection
              profile={profile}
              onProfileChange={setProfile}
              onSave={handleSaveProfile}
              onUploadPhoto={handleUploadPhoto}
              saving={saving}
            />
          )}

          {/* Clinic (Admin only) */}
          {activeTab === 'clinic' && isAdmin && (
            <ClinicSection
              clinic={clinic}
              onClinicChange={setClinic}
              onSave={handleSaveClinic}
              saving={saving}
            />
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <NotificationsSection
              notifications={notifications}
              onNotificationsChange={setNotifications}
              onSave={handleSaveNotifications}
              saving={saving}
            />
          )}

          {/* Calendar Integration */}
          {activeTab === 'calendar' && (
            <div className="card">
              <CalendarIntegration />
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <SecuritySection
              passwordData={passwordData}
              onPasswordDataChange={setPasswordData}
              onSave={handleChangePassword}
              saving={saving}
            />
          )}

          {/* Twilio (Admin only) */}
          {activeTab === 'twilio' && isAdmin && (
            <TwilioSection
              twilio={twilio}
              onTwilioChange={setTwilio}
              onSave={handleSaveTwilio}
              onTest={handleTestTwilio}
              saving={saving}
            />
          )}

          {/* LIS/HL7 (Admin only) */}
          {activeTab === 'lis' && isAdmin && (
            <div className="card">
              <LISIntegration />
            </div>
          )}

          {/* Permissions (Admin only) */}
          {activeTab === 'permissions' && isAdmin && (
            <div className="card">
              <RolePermissionsManager />
            </div>
          )}

          {/* Billing (Admin & Accountant) */}
          {activeTab === 'billing' && canManageBilling && (
            <BillingSection
              taxes={taxes}
              taxesLoading={taxesLoading}
              showTaxModal={showTaxModal}
              editingTax={editingTax}
              taxForm={taxForm}
              onTaxFormChange={setTaxForm}
              saving={taxSaving}
              onOpenModal={handleOpenTaxModal}
              onCloseModal={handleCloseTaxModal}
              onSaveTax={handleSaveTax}
              onDeleteTax={handleDeleteTax}
            />
          )}

          {/* Tarifs (Admin & Accountant) */}
          {activeTab === 'tarifs' && canManageBilling && (
            <div className="card">
              <TarifManagement />
            </div>
          )}

          {/* Referrers (Admin & Accountant) */}
          {activeTab === 'referrers' && canManageBilling && (
            <div className="card">
              <ReferrerManagement />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}
