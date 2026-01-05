import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  Shield,
  Users,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertTriangle,
  Settings,
  Eye,
  Edit3,
  Trash2,
  Plus,
  RotateCcw
} from 'lucide-react';
import rolePermissionService from '../../services/rolePermissionService';

export default function RolePermissionsManager() {
  const [rolePermissions, setRolePermissions] = useState([]);
  const [options, setOptions] = useState({ menuItems: [], permissions: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);
  const [editedRoles, setEditedRoles] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [permissionsRes, optionsRes] = await Promise.all([
        rolePermissionService.getAllRolePermissions(),
        rolePermissionService.getOptions()
      ]);
      // Safely extract arrays from various API response formats
      const rawPermissions = permissionsRes?.data?.data ?? permissionsRes?.data ?? [];
      setRolePermissions(Array.isArray(rawPermissions) ? rawPermissions : []);
      const rawOptions = optionsRes?.data?.data ?? optionsRes?.data ?? { menuItems: [], permissions: [], roles: [] };
      setOptions(rawOptions && typeof rawOptions === 'object' ? rawOptions : { menuItems: [], permissions: [], roles: [] });
      setEditedRoles({});
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading role permissions:', error);
      toast.error('Erreur lors du chargement des permissions');
    } finally {
      setLoading(false);
    }
  };

  const getRoleData = (role) => {
    if (editedRoles[role]) {
      return editedRoles[role];
    }
    return rolePermissions.find(rp => rp.role === role) || {
      role,
      menuItems: [],
      permissions: [],
      label: options.roles.find(r => r.id === role)?.label || role,
      isActive: true
    };
  };

  const handleToggleMenuItem = (role, menuItem) => {
    const currentData = getRoleData(role);
    const newMenuItems = currentData.menuItems.includes(menuItem)
      ? currentData.menuItems.filter(m => m !== menuItem)
      : [...currentData.menuItems, menuItem];

    setEditedRoles(prev => ({
      ...prev,
      [role]: { ...currentData, menuItems: newMenuItems }
    }));
    setHasChanges(true);
  };

  const handleTogglePermission = (role, permission) => {
    const currentData = getRoleData(role);
    const newPermissions = currentData.permissions.includes(permission)
      ? currentData.permissions.filter(p => p !== permission)
      : [...currentData.permissions, permission];

    setEditedRoles(prev => ({
      ...prev,
      [role]: { ...currentData, permissions: newPermissions }
    }));
    setHasChanges(true);
  };

  const handleSaveRole = async (role) => {
    const roleData = editedRoles[role];
    if (!roleData) return;

    try {
      setSaving(true);
      await rolePermissionService.updateRolePermission(role, roleData);
      toast.success(`Permissions de "${roleData.label || role}" mises à jour`);

      // Update local state
      setRolePermissions(prev => {
        const index = prev.findIndex(rp => rp.role === role);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...roleData };
          return updated;
        }
        return [...prev, roleData];
      });

      // Clear edited state for this role
      setEditedRoles(prev => {
        const { [role]: _, ...rest } = prev;
        return rest;
      });

      if (Object.keys(editedRoles).length <= 1) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error saving role permissions:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const rolesToSave = Object.keys(editedRoles);
    if (rolesToSave.length === 0) return;

    setSaving(true);

    // Use Promise.allSettled for parallel execution with partial failure handling
    const savePromises = rolesToSave.map(role =>
      rolePermissionService.updateRolePermission(role, editedRoles[role])
        .then(() => ({ role, success: true }))
        .catch(error => {
          console.error(`Error saving ${role}:`, error);
          return { role, success: false };
        })
    );

    const results = await Promise.allSettled(savePromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;

    if (successCount > 0) {
      toast.success(`${successCount} rôle(s) mis à jour`);
      await loadData();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de la sauvegarde`);
    }

    setSaving(false);
  };

  const handleResetRole = async (role) => {
    if (!confirm(`Réinitialiser les permissions de "${role}" aux valeurs par défaut ?`)) {
      return;
    }

    try {
      setSaving(true);
      await rolePermissionService.resetRoleToDefaults(role);
      toast.success('Permissions réinitialisées');
      await loadData();
    } catch (error) {
      console.error('Error resetting role:', error);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = (role) => {
    setEditedRoles(prev => {
      const { [role]: _, ...rest } = prev;
      return rest;
    });
    if (Object.keys(editedRoles).length <= 1) {
      setHasChanges(false);
    }
  };

  // Group permissions by category (memoized to avoid recomputation on every render)
  const groupedPermissions = useMemo(() => {
    return options.permissions.reduce((acc, perm) => {
      const category = perm.category || 'Autre';
      if (!acc[category]) acc[category] = [];
      acc[category].push(perm);
      return acc;
    }, {});
  }, [options.permissions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Gestion des Permissions par Rôle
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configurez les accès et permissions pour chaque rôle utilisateur
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="btn btn-secondary flex items-center gap-2"
            disabled={loading || saving}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              className="btn btn-primary flex items-center gap-2"
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              Sauvegarder tout ({Object.keys(editedRoles).length})
            </button>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-yellow-800 font-medium">
              Modifications non sauvegardées
            </p>
            <p className="text-xs text-yellow-700">
              {Object.keys(editedRoles).length} rôle(s) modifié(s). N'oubliez pas de sauvegarder vos changements.
            </p>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="space-y-4">
        {options.roles.map((roleOption) => {
          const roleData = getRoleData(roleOption.id);
          const isExpanded = expandedRole === roleOption.id;
          const isEdited = !!editedRoles[roleOption.id];
          const isAdmin = roleOption.id === 'admin';

          return (
            <div
              key={roleOption.id}
              className={`bg-white rounded-xl border ${isEdited ? 'border-yellow-400 shadow-md' : 'border-gray-200'} overflow-hidden`}
            >
              {/* Role Header */}
              <div
                className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-gray-50 border-b' : ''}`}
                onClick={() => setExpandedRole(isExpanded ? null : roleOption.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isAdmin ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    <Users className={`w-6 h-6 ${isAdmin ? 'text-purple-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{roleOption.label}</h3>
                      {isAdmin && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                          Système
                        </span>
                      )}
                      {isEdited && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                          Modifié
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {roleData.menuItems?.length || 0} menus • {roleData.permissions?.length || 0} permissions
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEdited && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelChanges(roleOption.id); }}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title="Annuler les modifications"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveRole(roleOption.id); }}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                        title="Sauvegarder"
                        disabled={saving}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResetRole(roleOption.id); }}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Réinitialiser aux valeurs par défaut"
                    disabled={saving}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-6 space-y-6">
                  {/* Menu Items */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-gray-500" />
                      Accès aux menus
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {options.menuItems.map((menuItem) => {
                        const isChecked = roleData.menuItems?.includes(menuItem.id);
                        const isDisabled = isAdmin && ['settings', 'audit', 'dashboard'].includes(menuItem.id);

                        return (
                          <label
                            key={menuItem.id}
                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => !isDisabled && handleToggleMenuItem(roleOption.id, menuItem.id)}
                              disabled={isDisabled}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{menuItem.label}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Permissions by Category */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-500" />
                      Permissions détaillées
                    </h4>
                    <div className="space-y-4">
                      {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <div key={category} className="border rounded-lg p-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-3">{category}</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {perms.map((perm) => {
                              const isChecked = roleData.permissions?.includes(perm.id);
                              const isDisabled = isAdmin && ['manage_users', 'manage_system', 'view_all_data'].includes(perm.id);

                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-green-50'
                                      : 'hover:bg-gray-50'
                                  } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => !isDisabled && handleTogglePermission(roleOption.id, perm.id)}
                                    disabled={isDisabled}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-sm text-gray-700">{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          const allMenuItems = options.menuItems.map(m => m.id);
                          setEditedRoles(prev => ({
                            ...prev,
                            [roleOption.id]: { ...roleData, menuItems: allMenuItems }
                          }));
                          setHasChanges(true);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Tous les menus
                      </button>
                      <button
                        onClick={() => {
                          // Preserve critical menu items for admin
                          const menuItems = isAdmin
                            ? ['settings', 'audit', 'dashboard']
                            : [];
                          setEditedRoles(prev => ({
                            ...prev,
                            [roleOption.id]: { ...roleData, menuItems }
                          }));
                          setHasChanges(true);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        {isAdmin ? 'Menus minimaux' : 'Aucun menu'}
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => {
                          const allPermissions = options.permissions.map(p => p.id);
                          setEditedRoles(prev => ({
                            ...prev,
                            [roleOption.id]: { ...roleData, permissions: allPermissions }
                          }));
                          setHasChanges(true);
                        }}
                        className="text-sm text-green-600 hover:text-green-700"
                      >
                        Toutes les permissions
                      </button>
                      <button
                        onClick={() => {
                          // Preserve critical permissions for admin
                          const permissions = isAdmin
                            ? ['manage_users', 'manage_system', 'view_all_data']
                            : [];
                          setEditedRoles(prev => ({
                            ...prev,
                            [roleOption.id]: { ...roleData, permissions }
                          }));
                          setHasChanges(true);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        {isAdmin ? 'Permissions minimales' : 'Aucune permission'}
                      </button>
                    </div>

                    {isEdited && (
                      <button
                        onClick={() => handleSaveRole(roleOption.id)}
                        className="btn btn-primary flex items-center gap-2"
                        disabled={saving}
                      >
                        <Save className="w-4 h-4" />
                        Sauvegarder ce rôle
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
