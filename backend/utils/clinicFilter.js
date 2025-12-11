/**
 * Utility for consistent clinic-based multi-tenancy filtering
 */

const buildClinicFilter = (req, clinicField = 'clinic') => {
  if (req.user?.accessAllClinics || req.user?.role === 'superadmin') {
    return {};
  }
  const clinicId = req.user?.clinic || req.clinicId;
  if (!clinicId) {
    return { [clinicField]: null };
  }
  return { [clinicField]: clinicId };
};

const verifyClinicAccess = (resource, req, clinicField = 'clinic') => {
  if (req.user?.accessAllClinics || req.user?.role === 'superadmin') {
    return true;
  }
  const userClinic = req.user?.clinic || req.clinicId;
  const resourceClinic = resource[clinicField];
  if (!userClinic || !resourceClinic) {
    return false;
  }
  return userClinic.toString() === resourceClinic.toString();
};

const requireClinicAccess = (getResource, clinicField = 'clinic') => {
  return async (req, res, next) => {
    try {
      const resource = await getResource(req);
      if (!resource) {
        return res.status(404).json({ success: false, error: 'Resource not found' });
      }
      if (!verifyClinicAccess(resource, req, clinicField)) {
        return res.status(403).json({ success: false, error: 'Access denied - resource belongs to different clinic' });
      }
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { buildClinicFilter, verifyClinicAccess, requireClinicAccess };
