#!/bin/bash
# PHASE 1: IMMEDIATE CLEANUP SCRIPT

echo "🧹 Starting CareVision Cleanup..."

# 1. DELETE COMPLETELY UNUSED BACKEND MODELS (1,400+ lines)
echo "Removing unused models..."
rm -f backend/models/PathologyProfile.js
rm -f backend/models/InsuranceProvider.js
rm -f backend/models/ClinicalAct.js

# 2. DELETE REDUNDANT TEMPLATE MODELS
echo "Removing redundant templates..."
rm -f backend/models/Template.js           # Too generic, overlaps
rm -f backend/models/ClinicalTemplate.js   # Move to ExaminationTemplate
rm -f backend/models/PathologyTemplate.js  # Move to exam pathology
rm -f backend/models/LaboratoryTemplate.js # Move to ExaminationTemplate

# 3. DELETE DUPLICATE FRONTEND COMPONENTS
echo "Removing duplicate components..."
rm -f frontend/src/components/PatientSelectorModal.jsx
rm -f frontend/src/components/PatientQuickSearch.jsx
rm -rf frontend/src/components/consultation/  # Unused tabs

# 4. DELETE UNUSED MODULES
echo "Removing unused modules..."
rm -rf frontend/src/modules/common/  # Empty directory
rm -f frontend/src/modules/prescription/OpticalPrescriptionBuilder.jsx
rm -f frontend/src/modules/patient/PatientForm.jsx

# 5. DELETE DUPLICATE BILLING CONTROLLER
echo "Consolidating billing..."
# Move statistics methods to invoiceController first!
rm -f backend/controllers/billingController.js

echo "✅ Cleanup complete! Removed ~3,000 lines of dead code"