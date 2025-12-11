import api from './apiConfig';

const rolePermissionService = {
  // Get all role permissions (admin only)
  getAllRolePermissions: async () => {
    const response = await api.get('/role-permissions');
    return response.data;
  },

  // Get current user's permissions
  getMyPermissions: async () => {
    const response = await api.get('/role-permissions/me');
    return response.data;
  },

  // Get available options (menu items, permissions, roles)
  getOptions: async () => {
    const response = await api.get('/role-permissions/options');
    return response.data;
  },

  // Get single role permission
  getRolePermission: async (role) => {
    const response = await api.get(`/role-permissions/${role}`);
    return response.data;
  },

  // Update role permission
  updateRolePermission: async (role, data) => {
    const response = await api.put(`/role-permissions/${role}`, data);
    return response.data;
  },

  // Reset role to defaults
  resetRoleToDefaults: async (role) => {
    const response = await api.post(`/role-permissions/${role}/reset`);
    return response.data;
  },

  // Delete/deactivate role permission
  deleteRolePermission: async (role) => {
    const response = await api.delete(`/role-permissions/${role}`);
    return response.data;
  }
};

export default rolePermissionService;
