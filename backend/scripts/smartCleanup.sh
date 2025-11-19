#!/bin/bash

# SMART CLEANUP SCRIPT FOR CAREVISION
# This script only removes truly unused code while preserving clinic-needed features
# As requested: ALL equipment and medications from clinics must be preserved

echo "================================================"
echo "🧹 SMART CAREVISION CLEANUP"
echo "   Preserving all clinic-needed features"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to safely delete files
safe_delete() {
    if [ -f "$1" ]; then
        echo -e "${RED}Deleting:${NC} $1"
        rm -f "$1"
    else
        echo -e "${YELLOW}Not found (already deleted?):${NC} $1"
    fi
}

# Function to safely delete directories
safe_delete_dir() {
    if [ -d "$1" ]; then
        echo -e "${RED}Deleting directory:${NC} $1"
        rm -rf "$1"
    else
        echo -e "${YELLOW}Directory not found (already deleted?):${NC} $1"
    fi
}

echo "PHASE 1: Remove ONLY truly unused backend models"
echo "-------------------------------------------------"
# These models are never imported or used anywhere
safe_delete "backend/models/PathologyProfile.js"  # 622 lines of unused code
safe_delete "backend/models/InsuranceProvider.js"  # Never referenced
safe_delete "backend/models/ClinicalAct.js"        # Never used

echo ""
echo "PHASE 2: Remove truly redundant template models"
echo "-------------------------------------------------"
# Remove only the generic Template.js, keep specialized ones that have data
safe_delete "backend/models/Template.js"  # Too generic, never used

# DO NOT DELETE these - they have real clinical data:
echo -e "${GREEN}KEEPING:${NC} backend/models/ClinicalTemplate.js (has clinical procedures)"
echo -e "${GREEN}KEEPING:${NC} backend/models/PathologyTemplate.js (has pathology data)"
echo -e "${GREEN}KEEPING:${NC} backend/models/LaboratoryTemplate.js (needed for lab tests)"
echo -e "${GREEN}KEEPING:${NC} backend/models/ExaminationTemplate.js (has exam templates)"
echo -e "${GREEN}KEEPING:${NC} backend/models/MedicationTemplate.js (ALL medications including non-eye)"
echo -e "${GREEN}KEEPING:${NC} backend/models/DocumentTemplate.js (letter generation)"

# Remove LetterTemplate since we're using DocumentTemplate instead
safe_delete "backend/models/LetterTemplate.js"

echo ""
echo "PHASE 3: Controller consolidation (merge, don't delete yet)"
echo "-------------------------------------------------------------"
echo -e "${YELLOW}TODO:${NC} Manually merge billingController into invoiceController"
echo -e "${YELLOW}TODO:${NC} After merging, delete: backend/controllers/billingController.js"
echo -e "${GREEN}KEEPING:${NC} Both prescription and pharmacy controllers (different purposes)"

echo ""
echo "PHASE 4: Remove duplicate frontend components"
echo "----------------------------------------------"
# These are truly duplicates
safe_delete "frontend/src/components/PatientSelectorModal.jsx"
safe_delete "frontend/src/components/PatientQuickSearch.jsx"
echo -e "${GREEN}KEEPING:${NC} frontend/src/modules/patient/PatientSelector.jsx (main component)"

echo ""
echo "PHASE 5: Remove unused frontend consultation components"
echo "--------------------------------------------------------"
safe_delete_dir "frontend/src/components/consultation/"  # Unused tabs

echo ""
echo "PHASE 6: Clean up unused frontend modules"
echo "------------------------------------------"
safe_delete_dir "frontend/src/modules/common/"  # Empty directory
safe_delete "frontend/src/modules/prescription/OpticalPrescriptionBuilder.jsx"
safe_delete "frontend/src/modules/patient/PatientForm.jsx"  # Duplicate

echo ""
echo "PHASE 7: Remove duplicate connected components"
echo "-----------------------------------------------"
# These are the old connected pattern that's been replaced
safe_delete "frontend/src/pages/AppointmentFormConnected.jsx"
safe_delete "frontend/src/pages/AppointmentsListConnected.jsx"
safe_delete "frontend/src/pages/DashboardConnected.jsx"
safe_delete "frontend/src/pages/PatientDetailsConnected.jsx"
safe_delete "frontend/src/pages/PatientFormConnected.jsx"
safe_delete "frontend/src/pages/PatientsListConnected.jsx"

echo ""
echo "PHASE 8: Remove unused layouts"
echo "-------------------------------"
safe_delete "frontend/src/layouts/ClinicalLayout.jsx"  # Not used

echo ""
echo "PHASE 9: Clean documentation (but keep deployment guides)"
echo "----------------------------------------------------------"
echo -e "${GREEN}KEEPING:${NC} All deployment guides for reference"
echo -e "${GREEN}KEEPING:${NC} README files"

echo ""
echo "================================================"
echo "✅ SMART CLEANUP COMPLETE"
echo "================================================"
echo ""
echo "PRESERVED:"
echo "----------"
echo "✓ ALL laboratory equipment integration"
echo "✓ ALL medications including non-eye (ovules, gastric, etc.)"
echo "✓ ALL template models with real data"
echo "✓ Document generation system"
echo "✓ Equipment catalog and integration"
echo "✓ Both prescription and pharmacy controllers"
echo ""
echo "NEXT STEPS:"
echo "-----------"
echo "1. Run the equipment seeding script:"
echo "   node backend/scripts/seedAllClinicEquipment.js"
echo ""
echo "2. Run the medication seeding script:"
echo "   node backend/scripts/seedAllClinicMedications.js"
echo ""
echo "3. Add letter templates to document system:"
echo "   node backend/scripts/addLetterTemplatesToDocumentSystem.js"
echo ""
echo "4. Manually merge billingController into invoiceController"
echo ""
echo "5. Test the application to ensure nothing is broken"
echo ""
echo "6. Commit changes:"
echo "   git add ."
echo "   git commit -m 'Smart cleanup: Remove only truly unused code, preserve all clinic features'"
echo ""