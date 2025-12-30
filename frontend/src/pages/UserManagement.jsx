/**
 * User Management Page
 * Administrative interface for managing system users
 */

import React, { useState, useEffect } from 'react';
import api from '../services/apiConfig';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'receptionist',
    department: '',
    phoneNumber: '',
    employeeId: '',
    isActive: true,
    permissions: []
  });

  // Roles must match backend User model enum exactly
  const roles = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'doctor', label: 'Médecin' },
    { value: 'ophthalmologist', label: 'Ophtalmologue' },
    { value: 'optometrist', label: 'Optométriste' },
    { value: 'orthoptist', label: 'Orthoptiste' },
    { value: 'nurse', label: 'Infirmier(ère)' },
    { value: 'receptionist', label: 'Réceptionniste' },
    { value: 'pharmacist', label: 'Pharmacien(ne)' },
    { value: 'lab_technician', label: 'Technicien Labo' },
    { value: 'technician', label: 'Technicien' },
    { value: 'manager', label: 'Manager' },
    { value: 'radiologist', label: 'Radiologue' },
    { value: 'accountant', label: 'Comptable' }
  ];

  // Departments must match backend User model enum exactly (lowercase)
  const departments = [
    { value: 'general', label: 'Général' },
    { value: 'ophthalmology', label: 'Ophtalmologie' },
    { value: 'pharmacy', label: 'Pharmacie' },
    { value: 'laboratory', label: 'Laboratoire' },
    { value: 'radiology', label: 'Radiologie' },
    { value: 'pediatrics', label: 'Pédiatrie' },
    { value: 'cardiology', label: 'Cardiologie' },
    { value: 'orthopedics', label: 'Orthopédie' },
    { value: 'emergency', label: 'Urgences' }
  ];

  const permissionGroups = {
    patients: ['view_patients', 'create_patients', 'edit_patients', 'delete_patients'],
    appointments: ['view_appointments', 'create_appointments', 'edit_appointments', 'cancel_appointments'],
    prescriptions: ['view_prescriptions', 'create_prescriptions', 'dispense_prescriptions'],
    billing: ['view_invoices', 'create_invoices', 'process_payments', 'apply_discounts'],
    reports: ['view_reports', 'export_reports', 'financial_reports'],
    settings: ['manage_users', 'manage_settings', 'manage_roles', 'view_audit_logs']
  };

  // French labels for permission groups and individual permissions
  const groupLabels = {
    patients: 'Patients',
    appointments: 'Rendez-vous',
    prescriptions: 'Ordonnances',
    billing: 'Facturation',
    reports: 'Rapports',
    settings: 'Paramètres'
  };

  const permissionLabels = {
    view_patients: 'Voir les patients',
    create_patients: 'Créer des patients',
    edit_patients: 'Modifier les patients',
    delete_patients: 'Supprimer les patients',
    view_appointments: 'Voir les rendez-vous',
    create_appointments: 'Créer des rendez-vous',
    edit_appointments: 'Modifier les rendez-vous',
    cancel_appointments: 'Annuler les rendez-vous',
    view_prescriptions: 'Voir les ordonnances',
    create_prescriptions: 'Créer des ordonnances',
    dispense_prescriptions: 'Dispenser les ordonnances',
    view_invoices: 'Voir les factures',
    create_invoices: 'Créer des factures',
    process_payments: 'Traiter les paiements',
    apply_discounts: 'Appliquer des remises',
    view_reports: 'Voir les rapports',
    export_reports: 'Exporter les rapports',
    financial_reports: 'Rapports financiers',
    manage_users: 'Gérer les utilisateurs',
    manage_settings: 'Gérer les paramètres',
    manage_roles: 'Gérer les rôles',
    view_audit_logs: 'Voir les journaux d\'audit'
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      // Ensure we always get an array - handle various API response formats
      const usersData = response.data?.data || response.data?.users || response.data;
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setError('Échec du chargement des utilisateurs');
      setUsers([]); // Ensure users is always an array even on error
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePermissionChange = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data - don't send empty password when editing
      const submitData = { ...formData };
      if (editingUser && !submitData.password) {
        delete submitData.password;
      }

      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, submitData);
      } else {
        await api.post('/users', submitData);
      }
      fetchUsers();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Échec de l\'enregistrement de l\'utilisateur');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      password: '', // Don't prefill password for security
      role: user.role || 'receptionist',
      department: user.department || '',
      phoneNumber: user.phoneNumber || '',
      employeeId: user.employeeId || '',
      isActive: user.isActive !== false,
      permissions: user.permissions || []
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await api.patch(`/users/${userId}/status`, { isActive: !currentStatus });
      fetchUsers();
    } catch (err) {
      setError('Échec de la mise à jour du statut');
    }
  };

  const handleResetPassword = async (userId) => {
    if (window.confirm('Envoyer un email de réinitialisation du mot de passe à cet utilisateur ?')) {
      try {
        await api.post(`/users/${userId}/reset-password`);
        alert('Email de réinitialisation du mot de passe envoyé avec succès');
      } catch (err) {
        setError('Échec de l\'envoi de l\'email de réinitialisation');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      username: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'receptionist',
      department: '',
      phoneNumber: '',
      employeeId: '',
      isActive: true,
      permissions: []
    });
  };

  // Safety check: ensure users is always an array before filtering
  const filteredUsers = (Array.isArray(users) ? users : []).filter(user => {
    const matchesSearch =
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? user.isActive : !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérer les utilisateurs, rôles et permissions du système
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Ajouter un utilisateur
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher</label>
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les rôles</option>
              {roles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-sm text-gray-500">
              {filteredUsers.length} sur {users.length} utilisateurs
            </span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rôle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Département
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dernière connexion
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map(user => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {roles.find(r => r.value === user.role)?.label || user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.department || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Jamais'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleToggleStatus(user._id, user.isActive)}
                    className={`${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} mr-3`}
                  >
                    {user.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => handleResetPassword(user._id)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Réinitialiser mot de passe
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom d'utilisateur *</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      placeholder="ex: jean.dupont"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID Employé *</label>
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleInputChange}
                      required
                      placeholder="ex: EMP001"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prénom *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Mot de passe {editingUser ? '' : '*'}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required={!editingUser}
                      minLength={12}
                      placeholder={editingUser ? 'Laisser vide pour conserver' : 'Min. 12 caractères'}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    {!editingUser && (
                      <p className="mt-1 text-xs text-gray-500">Minimum 12 caractères requis</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Téléphone *</label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      required
                      placeholder="+243 xxx xxx xxx"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rôle *</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      {roles.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Département</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Sélectionner un département</option>
                      {departments.map(dept => (
                        <option key={dept.value} value={dept.value}>{dept.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Utilisateur actif</span>
                  </label>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Permissions</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(permissionGroups).map(([group, perms]) => (
                      <div key={group} className="border rounded-md p-3">
                        <h5 className="text-sm font-medium text-gray-900 mb-2">{groupLabels[group]}</h5>
                        {perms.map(perm => (
                          <label key={perm} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(perm)}
                              onChange={() => handlePermissionChange(perm)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-gray-600">
                              {permissionLabels[perm]}
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingUser ? 'Enregistrer' : 'Créer l\'utilisateur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
