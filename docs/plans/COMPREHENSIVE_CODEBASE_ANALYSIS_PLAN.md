# Comprehensive Codebase Analysis Plan
## MedFlow/CareVision - Complete Analysis

**Generated:** 2025-12-12
**Total Files to Analyze:** ~600+ source files
**Estimated Reading Scope:** Every file except markdown documentation

---

## Executive Summary

This plan documents the systematic approach to read and analyze EVERY source file in the MedFlow/CareVision healthcare management system. The codebase consists of:

| Component | Files | Description |
|-----------|-------|-------------|
| Backend | ~489 | Node.js/Express API server |
| Frontend | ~486 | React/Vite web application |
| Central Server | 19 | Multi-clinic sync hub |
| OCR Service | 12 | Python FastAPI OCR processing |
| Face Service | TBD | Python face recognition |
| Playwright Tests | 16 | E2E test suites |
| Config/Data | ~25 | JSON, YAML, env files |

---

## PHASE 1: Foundation & Configuration (Priority: Critical)
*Understanding the system's core configuration and entry points*

### 1.1 Root Configuration Files
```
Files to read:
├── ecosystem.config.js                    # PM2 deployment config
├── .claude/settings.local.json            # Claude Code settings
├── COMPLETE_DATA_FLOWS.html               # Data flow documentation
├── COMPLETE_SYSTEM_MATRIX.html            # System matrix
├── MEDFLOW_ARCHITECTURE.html              # Architecture diagram
└── MEDFLOW_DATA_FLOW.html                 # Data flow diagram
```

### 1.2 Backend Configuration (7 files)
```
backend/config/
├── constants.js                           # System-wide constants
├── defaults.js                            # Default values
├── disableTransactions.js                 # Transaction toggle
├── errorMessages.js                       # Error message catalog
├── logger.js                              # Winston logging config
├── redis.js                               # Redis connection
└── swagger.js                             # API documentation config
```

### 1.3 Backend Entry Point
```
├── backend/server.js                      # Main server entry
├── backend/.env                           # Environment variables
├── backend/.env.example                   # Env template
├── backend/.env.goma                      # Goma clinic config
├── backend/.env.kinshasa                  # Kinshasa clinic config
├── backend/.env.lubumbashi                # Lubumbashi clinic config
├── backend/.env.production.template       # Production template
├── backend/.env.central.template          # Central server template
├── backend/.env.clinic.template           # Clinic template
├── backend/package.json                   # Dependencies
├── backend/.eslintrc.js                   # ESLint config
├── backend/jest.config.js                 # Jest test config
└── backend/migrate-mongo-config.js        # MongoDB migration config
```

### 1.4 Frontend Configuration
```
frontend/
├── eslint.config.js                       # ESLint config
├── postcss.config.js                      # PostCSS config
├── vite.config.js                         # Vite build config
├── package.json                           # Dependencies
├── index.html                             # HTML entry
├── tailwind.config.js                     # Tailwind CSS config
└── src/main.jsx                           # React entry point
```

---

## PHASE 2: Data Models (Priority: Critical)
*Understanding the complete data schema - 83 MongoDB models*

### 2.1 Core Patient/Clinical Models
```
backend/models/
├── Patient.js                             # Core patient record
├── Visit.js                               # Patient visits
├── Appointment.js                         # Appointment scheduling
├── AppointmentType.js                     # Appointment categories
├── Prescription.js                        # Prescriptions
├── OphthalmologyExam.js                   # Eye examinations
├── OrthopticExam.js                       # Orthoptic exams
├── ClinicalAlert.js                       # Clinical alerts
├── ClinicalAct.js                         # Clinical procedures
├── ClinicalTemplate.js                    # Clinical templates
├── Document.js                            # Patient documents
├── DeviceMeasurement.js                   # Device readings
├── DeviceImage.js                         # Device images
└── Correspondence.js                      # Patient correspondence
```

### 2.2 User & Authentication Models
```
├── User.js                                # User accounts
├── RolePermission.js                      # Role-based permissions
├── Clinic.js                              # Clinic definitions
├── Settings.js                            # System settings
├── Referrer.js                            # Referring physicians
├── Provider.js                            # Healthcare providers
└── ProviderAvailability.js                # Provider schedules
```

### 2.3 Financial/Billing Models
```
├── Invoice.js                             # Patient invoices
├── PaymentPlan.js                         # Payment plans
├── InsuranceClaim.js                      # Insurance claims
├── FeeSchedule.js                         # Fee schedules
├── ConventionFeeSchedule.js               # Convention pricing
├── TaxConfig.js                           # Tax configuration
├── FiscalYear.js                          # Fiscal year settings
├── Company.js                             # Insurance companies
└── Approval.js                            # Payment approvals
```

### 2.4 Inventory Models
```
├── PharmacyInventory.js                   # Pharmacy stock
├── FrameInventory.js                      # Optical frames
├── ContactLensInventory.js                # Contact lenses
├── OpticalLensInventory.js                # Optical lenses
├── ReagentInventory.js                    # Lab reagents
├── ReagentLot.js                          # Reagent batch tracking
├── LabConsumableInventory.js              # Lab consumables
├── SurgicalSupplyInventory.js             # Surgical supplies
├── Drug.js                                # Drug catalog
├── EquipmentCatalog.js                    # Equipment catalog
├── InventoryTransfer.js                   # Inter-clinic transfers
├── PurchaseOrder.js                       # Purchase orders
├── Supplier.js                            # Suppliers
├── StockReconciliation.js                 # Stock audits
└── UnitConversion.js                      # Unit conversions
```

### 2.5 Laboratory Models
```
├── LabOrder.js                            # Lab test orders
├── LabResult.js                           # Lab test results
├── LabAnalyzer.js                         # Lab equipment
├── LaboratoryTemplate.js                  # Lab test templates
├── LISIntegration.js                      # LIS system config
└── PathologyTemplate.js                   # Pathology templates
```

### 2.6 Imaging & Devices
```
├── Device.js                              # Medical devices
├── DeviceIntegrationLog.js                # Device sync logs
├── ImagingOrder.js                        # Imaging orders
├── ImagingStudy.js                        # Imaging studies
└── DeviceImage.js                         # Device captured images
```

### 2.7 Surgery & IVT
```
├── SurgeryCase.js                         # Surgery cases
├── SurgeryReport.js                       # Surgery reports
├── IVTVial.js                             # IVT medication vials
├── IVTInjection.js                        # IVT injections
└── WaitingList.js                         # Surgery waiting list
```

### 2.8 Optical Shop
```
├── GlassesOrder.js                        # Glasses orders
├── RepairTracking.js                      # Repair tracking
├── WarrantyTracking.js                    # Warranty tracking
└── FulfillmentDispatch.js                 # Order fulfillment
```

### 2.9 Templates & Catalogs
```
├── CommentTemplate.js                     # Comment templates
├── ConsultationTemplate.js                # Consultation templates
├── DocumentTemplate.js                    # Document templates
├── DoseTemplate.js                        # Dosing templates
├── ExaminationTemplate.js                 # Exam templates
├── LetterTemplate.js                      # Letter templates
├── MedicationTemplate.js                  # Medication templates
└── TreatmentProtocol.js                   # Treatment protocols
```

### 2.10 System & Integration
```
├── Alert.js                               # System alerts
├── AuditLog.js                            # Audit trail
├── CalendarIntegration.js                 # Calendar sync
├── ConsultationSession.js                 # Active sessions
├── Counter.js                             # Auto-increment counters
├── EmailQueue.js                          # Email queue
├── ExternalFacility.js                    # External facilities
├── LegacyMapping.js                       # Legacy data mapping
├── Notification.js                        # User notifications
├── Room.js                                # Clinic rooms
├── Service.js                             # Service definitions
└── SyncQueue.js                           # Multi-clinic sync queue
```

---

## PHASE 3: API Routes (Priority: Critical)
*Understanding all API endpoints - 76 route files*

### 3.1 Authentication & Users
```
backend/routes/
├── auth.js                                # Authentication endpoints
├── users.js                               # User management
├── rolePermissions.js                     # Permission management
└── portal.js                              # Patient portal
```

### 3.2 Patient Management
```
├── patients.js                            # Patient CRUD
├── patientHistory.js                      # Patient history
├── visits.js                              # Visit management
├── appointments.js                        # Appointment booking
├── queue.js                               # Patient queue
└── faceRecognition.js                     # Biometric auth
```

### 3.3 Clinical Routes
```
├── ophthalmology.js                       # Eye exams
├── orthoptic.js                           # Orthoptic exams
├── prescriptions.js                       # Prescriptions
├── clinicalAlerts.js                      # Clinical alerts
├── clinicalDecisionSupport.js             # CDS
├── clinicalTrends.js                      # Trend analysis
├── consultationSessions.js                # Sessions
├── consultationTemplates.js               # Templates
└── drugSafety.js                          # Drug interactions
```

### 3.4 Billing & Financial
```
├── billing.js                             # Billing operations
├── invoices.js                            # Invoice management
├── feeSchedules.js                        # Fee schedules
├── approvals.js                           # Payment approvals
├── companies.js                           # Insurance companies
└── fiscalYear.js                          # Fiscal management
```

### 3.5 Inventory Routes
```
├── pharmacy.js                            # Pharmacy operations
├── frameInventory.js                      # Frame inventory
├── contactLensInventory.js                # Contact lenses
├── opticalLensInventory.js                # Optical lenses
├── reagentInventory.js                    # Reagents
├── reagentLots.js                         # Reagent lots
├── labConsumableInventory.js              # Lab consumables
├── surgicalSupplyInventory.js             # Surgical supplies
├── crossClinicInventory.js                # Cross-clinic view
├── inventoryTransfers.js                  # Transfers
├── purchaseOrders.js                      # Purchase orders
└── stockReconciliations.js                # Stock audits
```

### 3.6 Laboratory Routes
```
├── laboratory.js                          # Lab module main
├── labOrders.js                           # Lab orders
├── labResults.js                          # Lab results
├── labAnalyzers.js                        # Lab equipment
├── labQC.js                               # Quality control
└── lis.js                                 # LIS integration
```

### 3.7 Imaging & Devices
```
├── imaging.js                             # Imaging operations
├── devices.js                             # Device management
├── uploads.js                             # File uploads
└── ocrImport.js                           # OCR import
```

### 3.8 Surgery & IVT
```
├── surgery.js                             # Surgery module
├── ivt.js                                 # IVT operations
└── ivtVials.js                            # IVT vial management
```

### 3.9 Optical Shop
```
├── glassesOrders.js                       # Glasses orders
├── opticalShop.js                         # Optical shop ops
├── repairs.js                             # Repair tracking
├── warranties.js                          # Warranty tracking
└── fulfillmentDispatches.js               # Order fulfillment
```

### 3.10 System & Integration
```
├── alerts.js                              # System alerts
├── audit.js                               # Audit trail
├── backup.js                              # Backup operations
├── calendar.js                            # Calendar sync
├── central.js                             # Central server comm
├── clinics.js                             # Clinic management
├── correspondence.js                      # Correspondence
├── dashboard.js                           # Dashboard data
├── documentGeneration.js                  # Document gen
├── documents.js                           # Document management
├── externalFacilities.js                  # External facilities
├── health.js                              # Health checks
├── migration.js                           # Data migration
├── notifications.js                       # Notifications
├── referrers.js                           # Referrers
├── rooms.js                               # Room management
├── settings.js                            # System settings
├── sync.js                                # Data sync
├── templateCatalog.js                     # Template catalog
├── treatmentProtocols.js                  # Protocols
└── unitConversions.js                     # Unit conversions
```

---

## PHASE 4: Controllers (Priority: Critical)
*Business logic implementation - 77 controller files*

### 4.1 Core Controllers
```
backend/controllers/
├── authController.js                      # Authentication logic
├── userController.js                      # User management
├── patientController.js                   # Patient operations
├── patientHistoryController.js            # History management
├── appointmentController.js               # Appointments
├── queueController.js                     # Queue management
```

### 4.2 Clinical Controllers
```
├── ophthalmologyController.js             # Eye exams
├── orthopticController.js                 # Orthoptic exams
├── prescriptionController.js              # Prescriptions
├── clinicalAlertController.js             # Clinical alerts
├── clinicalTrendController.js             # Trend analysis
├── consultationSessionController.js       # Sessions
├── surgeryController.js                   # Surgery
├── ivtController.js                       # IVT operations
├── ivtVialController.js                   # IVT vials
```

### 4.3 Billing Controllers
```
├── invoiceController.js                   # Invoice operations
├── approvalController.js                  # Approvals
├── companyController.js                   # Companies
├── billing/                               # Billing module
│   ├── index.js                           # Module entry
│   ├── cashDrawer.js                      # Cash drawer
│   ├── claims.js                          # Insurance claims
│   ├── conventions.js                     # Conventions
│   ├── documents.js                       # Billing documents
│   ├── feeSchedule.js                     # Fee schedules
│   ├── paymentPlans.js                    # Payment plans
│   ├── payments.js                        # Payments
│   └── statistics.js                      # Billing stats
```

### 4.4 Inventory Controllers
```
├── pharmacyController.js                  # Pharmacy
├── crossClinicInventoryController.js      # Cross-clinic
├── inventoryTransferController.js         # Transfers
├── purchaseOrderController.js             # Purchase orders
├── stockReconciliationController.js       # Stock audits
├── reagentLotController.js                # Reagent lots
├── unitConversionController.js            # Unit conversions
├── inventory/                             # Inventory module
│   ├── index.js                           # Module entry
│   ├── InventoryControllerFactory.js      # Factory pattern
│   ├── contactLensInventory.js            # Contact lenses
│   ├── frameInventory.js                  # Frames
│   ├── labConsumableInventory.js          # Lab consumables
│   ├── opticalLensInventory.js            # Optical lenses
│   ├── reagentInventory.js                # Reagents
│   └── surgicalSupplyInventory.js         # Surgical supplies
```

### 4.5 Laboratory Controllers
```
├── laboratory/                            # Lab module
│   ├── index.js                           # Module entry
│   ├── analyzers.js                       # Lab equipment
│   ├── billing.js                         # Lab billing
│   ├── orders.js                          # Lab orders
│   ├── reports.js                         # Lab reports
│   ├── results.js                         # Lab results
│   ├── specimens.js                       # Specimen tracking
│   ├── statistics.js                      # Lab stats
│   ├── templates.js                       # Lab templates
│   └── utils/
│       └── barcodeGenerator.js            # Barcode generation
```

### 4.6 Optical/Device Controllers
```
├── glassesOrderController.js              # Glasses orders
├── opticalShopController.js               # Optical shop
├── repairController.js                    # Repairs
├── warrantyController.js                  # Warranties
├── deviceController.js                    # Devices
├── imagingController.js                   # Imaging
├── tryOnPhotoController.js                # Try-on photos
├── fulfillmentDispatchController.js       # Fulfillment
```

### 4.7 System Controllers
```
├── alertController.js                     # Alerts
├── calendarController.js                  # Calendar
├── centralDataController.js               # Central data
├── clinicController.js                    # Clinics
├── documentController.js                  # Documents
├── documentGenerationController.js        # Doc generation
├── externalFacilityController.js          # External facilities
├── notificationController.js              # Notifications
├── ocrImportController.js                 # OCR import
├── portalController.js                    # Patient portal
├── referrerController.js                  # Referrers
├── roomController.js                      # Rooms
├── settingsController.js                  # Settings
├── templateCatalogController.js           # Templates
├── treatmentProtocolController.js         # Protocols
└── prescriptions/                         # Prescriptions module
    ├── index.js
    └── shared.js
```

---

## PHASE 5: Backend Services (Priority: Critical)
*Core business services - 71 service files*

### 5.1 Core Services
```
backend/services/
├── sessionService.js                      # Session management
├── notificationService.js                 # Push notifications
├── notificationFacade.js                  # Notification facade
├── enhancedNotificationService.js         # Enhanced notifications
├── emailService.js                        # Email sending
├── emailQueueService.js                   # Email queue
├── smsService.js                          # SMS sending
├── pdfGenerator.js                        # PDF generation
├── cacheService.js                        # Redis caching
├── paginationService.js                   # Pagination helper
├── sentryService.js                       # Error tracking
```

### 5.2 Clinical Services
```
├── clinicalAlertService.js                # Clinical alerts
├── drugSafetyService.js                   # Drug interactions
├── doseCalculationService.js              # Dose calculations
├── therapeuticClassService.js             # Drug classes
├── cumulativeDoseService.js               # Cumulative dosing
├── drGradingService.js                    # DR grading
├── gpaService.js                          # Glaucoma analysis
├── rnflAnalysisService.js                 # RNFL analysis
├── referralTriggerService.js              # Auto-referrals
├── ivtComplianceService.js                # IVT compliance
├── surgeonAnalyticsService.js             # Surgeon stats
├── ePrescribingService.js                 # E-prescribing
└── cerfaGenerator.js                      # CERFA forms
```

### 5.3 Inventory Services
```
├── autoReorderService.js                  # Auto-reorder
├── coldChainService.js                    # Cold chain monitoring
├── labelPrintingService.js                # Label printing
└── labAutoVerificationService.js          # Lab auto-verify
```

### 5.4 Laboratory Services
```
├── lisIntegrationService.js               # LIS integration
├── hl7ParserService.js                    # HL7 message parsing
├── westgardQCService.js                   # Westgard QC rules
```

### 5.5 Device Integration Services
```
├── deviceIntegration/
│   └── DeviceIntegrationService.js        # Device integration
├── deviceParsers/
│   └── nidekParser.js                     # Nidek device parser
├── deviceSyncQueue.js                     # Device sync queue
├── deviceSyncScheduler.js                 # Sync scheduler
├── networkDiscoveryService.js             # Network discovery
├── universalFileProcessor.js              # File processing
├── folderSyncService.js                   # Folder sync
├── patientFolderIndexer.js                # Patient folder indexer
├── smb2ClientService.js                   # SMB2 client
├── smbStreamService.js                    # SMB streaming
├── adapters/                              # Device adapters
│   ├── AdapterFactory.js                  # Adapter factory
│   ├── BaseAdapter.js                     # Base adapter
│   ├── AutorefractorAdapter.js            # Autorefractor
│   ├── BiometerAdapter.js                 # Biometer
│   ├── NidekAdapter.js                    # Nidek devices
│   ├── OctAdapter.js                      # OCT devices
│   ├── SpecularMicroscopeAdapter.js       # Specular microscope
│   └── TonometryAdapter.js                # Tonometry
```

### 5.6 Sync & Integration Services
```
├── dataSyncService.js                     # Data sync
├── cloudSyncService.js                    # Cloud sync
├── autoSyncService.js                     # Auto sync
├── centralServerClient.js                 # Central server client
├── fhirService.js                         # FHIR integration
├── calendarIntegrationService.js          # Calendar sync
├── legacyPatientMapper.js                 # Legacy data mapping
├── distributedLock.js                     # Distributed locking
```

### 5.7 Financial Services
```
├── currencyService.js                     # Multi-currency
├── paymentGateway.js                      # Payment processing
├── paymentPlanAutoChargeService.js        # Auto-charge
├── approvalValidationService.js           # Approval validation
└── appointmentValidationService.js        # Appointment validation
```

### 5.8 Scheduler Services
```
├── alertScheduler.js                      # Alert scheduler
├── backupScheduler.js                     # Backup scheduler
├── backupService.js                       # Backup operations
├── calendarSyncScheduler.js               # Calendar sync
├── invoiceReminderScheduler.js            # Invoice reminders
├── reminderScheduler.js                   # Appointment reminders
├── reservationCleanupScheduler.js         # Reservation cleanup
├── visitCleanupScheduler.js               # Visit cleanup
└── websocketService.js                    # WebSocket handling
```

---

## PHASE 6: Backend Middleware (Priority: High)
*Request/response processing - 12 middleware files*

```
backend/middleware/
├── auth.js                                # JWT authentication
├── clinicAuth.js                          # Clinic authentication
├── auditLogger.js                         # Audit logging
├── errorHandler.js                        # Error handling
├── rateLimiter.js                         # Rate limiting
├── fileUpload.js                          # File upload handling
├── csrf.js                                # CSRF protection
├── healthAuth.js                          # Health check auth
├── invoiceCategoryFilter.js               # Invoice filtering
├── metrics.js                             # Prometheus metrics
├── validate.js                            # Request validation
└── validation.js                          # Schema validation
```

---

## PHASE 7: Backend Utilities (Priority: High)
*Helper functions - 16 utility files*

```
backend/utils/
├── ageCalculator.js                       # Age calculation
├── apiResponse.js                         # API response formatting
├── clinicFilter.js                        # Clinic data filtering
├── dateUtils.js                           # Date utilities
├── envValidator.js                        # Environment validation
├── errorResponse.js                       # Error response helper
├── financialValidation.js                 # Financial validation
├── passwordValidator.js                   # Password validation
├── patientLookup.js                       # Patient lookup helper
├── phiEncryption.js                       # PHI encryption
├── sanitize.js                            # Input sanitization
├── sendEmail.js                           # Email utility
├── shellSecurity.js                       # Shell command security
├── structuredLogger.js                    # Structured logging
├── tokenUtils.js                          # JWT token utilities
└── transactions.js                        # MongoDB transactions
```

---

## PHASE 8: Backend Validators
*Input validation schemas - 3 files*

```
backend/validators/
├── appointmentValidator.js                # Appointment validation
├── invoiceValidator.js                    # Invoice validation
└── patientValidator.js                    # Patient validation
```

---

## PHASE 9: Backend Scripts (Priority: Medium)
*Maintenance and seed scripts - 124 files*

### 9.1 Admin/Setup Scripts
```
backend/scripts/
├── setup.js                               # Unified setup script
├── createAdminUser.js                     # Create admin
├── createAdminFixed.js                    # Admin fix
├── createDemoUsers.js                     # Demo users
├── resetAdmin.js                          # Reset admin
├── resetAdminPassword.js                  # Reset password
├── fixAdminPassword.js                    # Fix password
├── unlockAdmin.js                         # Unlock admin
├── verifyAdmin.js                         # Verify admin
├── verifyAdminPassword.js                 # Verify password
├── fix_admin.js                           # Admin fix
└── testResetAdmin.js                      # Test reset
```

### 9.2 Seed Scripts (~40+ files)
```
├── seedClinics.js                         # Clinics
├── seedUsers.js                           # Users
├── seedAppointmentTypes.js                # Appointment types
├── seedRolePermissions.js                 # Permissions
├── seedCongo.js                           # Congo data
├── seedCongoData.js                       # Congo data extended
├── seedConventions.js                     # Conventions
├── seedConventionRules.js                 # Convention rules
├── seedFeeScheduleAliases.js              # Fee aliases
├── seedCompleteFeeSchedule.js             # Fee schedules
├── seedCompleteServices.js                # Services
├── seedAdditionalServices.js              # Additional services
├── seedClinicalProcedures.js              # Clinical procedures
├── seedFrenchClinicalActs.js              # French acts
├── seedFrenchDrugs.js                     # French drugs
├── seedPharmacyInventory.js               # Pharmacy
├── seedFrameInventory.js                  # Frames
├── seedContactLensInventory.js            # Contact lenses
├── seedOpticalLensInventory.js            # Optical lenses
├── seedDepotFrames.js                     # Depot frames
├── seedReagentInventory.js                # Reagents
├── seedLabConsumableInventory.js          # Lab consumables
├── seedImagingData.js                     # Imaging
├── seedClinicDevices.js                   # Devices
├── seedDiscoveredDevices.js               # Discovered devices
├── seedAllClinicEquipment.js              # Equipment
├── seedAllClinicMedications.js            # Medications
├── seedMedicationFeeSchedules.js          # Medication fees
├── seedVitaminsFromTemplates.js           # Vitamins
├── seedTemplates.js                       # Templates
├── seedConsultationTemplates.js           # Consultation templates
├── seedDocumentTemplates.js               # Document templates
├── seedLetterTemplates.js                 # Letter templates
├── seedCommentTemplates.js                # Comment templates
├── seedDoseTemplatesComplete.js           # Dose templates
├── seedTreatmentProtocolsComplete.js      # Treatment protocols
├── seedComprehensiveConfig.js             # Comprehensive config
└── seedTestTransactionalData.js           # Test data
```

### 9.3 Migration Scripts (~15 files)
```
├── migrateLegacyPatients.js               # Legacy patients
├── migratePatientConvention.js            # Patient conventions
├── migratePHIEncryption.js                # PHI encryption
├── migrateFeeSchedulesToTemplates.js      # Fee schedules
├── migrateInventoryClinic.js              # Inventory clinic
├── migrateInvoiceItemIds.js               # Invoice items
├── migrateConsoleLogs.js                  # Console logs
├── dryRunMigration.js                     # Dry run
├── rollbackMigration.js                   # Rollback
├── backfillLegacyDataStatus.js            # Legacy status
└── backfillPrescriptions.js               # Prescriptions
```

### 9.4 Import Scripts (~10 files)
```
├── importLegacyActes.js                   # Legacy acts
├── importLegacyConsultations.js           # Legacy consultations
├── importLegacyDiagnoses.js               # Legacy diagnoses
├── importLegacyPharmacy.js                # Legacy pharmacy
├── importPatientsOnly.js                  # Patients only
├── importPatientsWithPapa.js              # Patients with parent
├── diagnosticImport.js                    # Diagnostic import
└── restoreFromLV.js                       # Restore from LV
```

### 9.5 Index Creation Scripts
```
├── createIndexes.js                       # Create indexes
├── createOptimizedIndexes.js              # Optimized indexes
├── createOpticalShopIndexes.js            # Optical shop indexes
├── createUniqueVisitIndex.js              # Visit index
└── indexNetworkShares.js                  # Network share index
```

### 9.6 Test Scripts (~15 files)
```
├── testApprovalInvoiceWorkflow.js         # Approval workflow
├── testApprovalRejection.js               # Approval rejection
├── testInvoiceControllerLogic.js          # Invoice logic
├── testInvoiceWorkflow.js                 # Invoice workflow
├── testPackageDeals.js                    # Package deals
├── testPharmacyEndpoint.js                # Pharmacy endpoint
├── testPharmacyInvoice.js                 # Pharmacy invoice
├── testSecurityFixes.js                   # Security fixes
├── testTemplateInsert.js                  # Template insert
├── comprehensiveConventionTest.js         # Convention test
├── e2eWorkflowTest.js                     # E2E workflow
└── productionReadinessTest.js             # Production test
```

### 9.7 Utility Scripts
```
├── checkAllCareVisionData.js              # Check data
├── checkData.js                           # Check data
├── checkDrugs.js                          # Check drugs
├── checkExistingPharmacy.js               # Check pharmacy
├── checkLanguage.js                       # Check language
├── checkRawDrugs.js                       # Check raw drugs
├── checkTemplates.js                      # Check templates
├── cleanupOrphanedData.js                 # Cleanup orphaned
├── listCollections.js                     # List collections
├── manualInspection.js                    # Manual inspection
├── diagnoseSeed.js                        # Diagnose seed
├── verifyConventionRules.js               # Verify conventions
├── verifyInvoice.js                       # Verify invoice
├── auditConventionRules.js                # Audit conventions
├── deepAuditCalculations.js               # Deep audit
├── deepAuditExtended.js                   # Extended audit
├── recalculateInvoiceTotals.js            # Recalculate totals
├── copyFeeSchedulesWithAdjustment.js      # Copy fee schedules
├── fixConventionInvoiceAmountDue.js       # Fix amounts
├── fixInvoiceApprovalFlags.js             # Fix flags
├── fixMissingInvoices.js                  # Fix missing
├── fixStuckVisits.js                      # Fix stuck visits
├── fixStuckVisitsSimple.js                # Simple fix
├── implementMaquetteSpecs.js              # Implement specs
├── addLetterTemplatesToDocumentSystem.js  # Add templates
├── dropDoseTemplates.js                   # Drop templates
├── updateDevicePaths.js                   # Update paths
├── updateFeeSchedules.js                  # Update fees
├── setClinicPriceModifiers.js             # Price modifiers
├── simulateLowStock.js                    # Simulate low stock
├── simulateLowStockAll.js                 # Simulate all
├── enrollPatientFace.js                   # Enroll face
├── rotateSecrets.js                       # Rotate secrets
├── createTestInvoice.js                   # Test invoice
├── createTestPatients.js                  # Test patients
├── createTestPharmacyData.js              # Test pharmacy
├── createSampleApprovals.js               # Sample approvals
└── count_csv_rows.js                      # Count CSV rows
```

---

## PHASE 10: Backend Tests (Priority: Medium)
*Test files - 13 files*

```
backend/tests/
├── setup.js                               # Test setup
├── sentryService.test.js                  # Sentry test
├── fixtures/
│   └── generators.js                      # Test generators
├── integration/
│   ├── appointments.test.js               # Appointment tests
│   ├── patients.test.js                   # Patient tests
│   └── queue.test.js                      # Queue tests
└── unit/
    ├── apiResponse.test.js                # API response tests
    ├── constants.test.js                  # Constants tests
    ├── envValidator.test.js               # Env validator tests
    ├── invoiceCalculations.test.js        # Invoice calc tests
    ├── patientLookup.test.js              # Patient lookup tests
    ├── prescriptionValidation.test.js     # Prescription tests
    └── queueManagement.test.js            # Queue tests
```

---

## PHASE 11: Backend Windows Agent
*Windows service agent - 4 files*

```
backend/agents/windows/
├── medflow-agent.js                       # Main agent
├── install-service.js                     # Service installer
├── uninstall-service.js                   # Service uninstaller
└── package.json                           # Agent dependencies
```

---

## PHASE 12: Backend Data Files
*Static data files - 3 files*

```
backend/data/
├── clinical-procedures.json               # Clinical procedures
├── medications.json                       # Medication catalog
└── orthoptic-data.json                    # Orthoptic data
```

---

## PHASE 13: Frontend - Core Entry Points (Priority: Critical)

```
frontend/src/
├── main.jsx                               # React entry
├── App.jsx                                # Root component
└── layouts/
    ├── MainLayout.jsx                     # Main layout
    └── PatientLayout.jsx                  # Patient layout
```

---

## PHASE 14: Frontend - Contexts (Priority: High)
*React contexts - 5 files*

```
frontend/src/contexts/
├── AuthContext.jsx                        # Authentication state
├── ClinicContext.jsx                      # Clinic selection
├── HistoryContext.jsx                     # Navigation history
├── PatientCacheContext.jsx                # Patient caching
└── PatientContext.jsx                     # Patient state
```

---

## PHASE 15: Frontend - Hooks (Priority: High)
*Custom React hooks - 17 files*

```
frontend/src/hooks/
├── index.js                               # Hook exports
├── useAbortController.js                  # Request abortion
├── useAlertEvaluation.js                  # Alert evaluation
├── useApi.js                              # API calls
├── useAutoSave.js                         # Auto-save
├── useFileUpload.js                       # File uploads
├── useInventory.js                        # Inventory operations
├── useKeyboardShortcuts.js                # Keyboard shortcuts
├── useOffline.js                          # Offline detection
├── useOfflineData.js                      # Offline data
├── usePermissions.js                      # Permission checks
├── usePreviousData.js                     # Previous values
├── usePreviousExamData.js                 # Previous exam data
├── useRedux.js                            # Redux hooks
├── useTabProgression.js                   # Tab navigation
├── useTrendData.js                        # Trend analysis
└── useWebSocket.js                        # WebSocket connection
```

---

## PHASE 16: Frontend - Store (Priority: High)
*Redux store configuration - 12 files*

```
frontend/src/store/
├── index.js                               # Store configuration
├── middleware/
│   └── offlineMiddleware.js               # Offline middleware
└── slices/
    ├── appointmentsSlice.js               # Appointments
    ├── authSlice.js                       # Authentication
    ├── clinicSlice.js                     # Clinic state
    ├── dashboardSlice.js                  # Dashboard
    ├── notificationSlice.js               # Notifications
    ├── offlineQueueSlice.js               # Offline queue
    ├── patientSlice.js                    # Patient state
    ├── queueSlice.js                      # Patient queue
    └── visitSlice.js                      # Visit state
```

---

## PHASE 17: Frontend - Services (Priority: Critical)
*API services - 85 files*

### 17.1 Core Services
```
frontend/src/services/
├── api.js                                 # Base API client
├── authService.js                         # Authentication
├── patientService.js                      # Patient operations
├── visitService.js                        # Visit operations
├── appointmentService.js                  # Appointments
├── userService.js                         # User management
├── clinicService.js                       # Clinic operations
├── settingsService.js                     # Settings
├── documentService.js                     # Documents
└── notificationService.js                 # Notifications
```

### 17.2 Clinical Services
```
├── ophthalmologyService.js                # Eye exams
├── orthopticService.js                    # Orthoptic exams
├── prescriptionService.js                 # Prescriptions
├── clinicalAlertService.js                # Clinical alerts
├── drugSafetyService.js                   # Drug safety
├── trendService.js                        # Trend analysis
├── treatmentProtocolService.js            # Treatment protocols
├── consultationSessionService.js          # Sessions
├── consultationTemplateService.js         # Templates
├── examinationTemplateService.js          # Exam templates
├── medicationTemplateService.js           # Medication templates
├── pathologyTemplateService.js            # Pathology templates
└── laboratoryTemplateService.js           # Lab templates
```

### 17.3 Billing Services
```
├── billingService.js                      # Billing operations
├── invoiceService.js                      # Invoices
├── feeScheduleService.js                  # Fee schedules
├── approvalService.js                     # Approvals
├── companyService.js                      # Companies
├── conventionService.js                   # Conventions
└── paymentPlanService.js                  # Payment plans
```

### 17.4 Inventory Services
```
├── pharmacyService.js                     # Pharmacy
├── frameInventoryService.js               # Frames
├── contactLensInventoryService.js         # Contact lenses
├── opticalLensInventoryService.js         # Optical lenses
├── reagentInventoryService.js             # Reagents
├── labConsumableService.js                # Lab consumables
├── surgicalSupplyService.js               # Surgical supplies
├── inventoryTransferService.js            # Transfers
├── crossClinicInventoryService.js         # Cross-clinic
├── purchaseOrderService.js                # Purchase orders
└── stockReconciliationService.js          # Stock audits
└── inventory/                             # Inventory module
    └── [inventory service files]
```

### 17.5 Laboratory Services
```
├── laboratoryService.js                   # Lab operations
├── labOrderService.js                     # Lab orders
├── labResultService.js                    # Lab results
├── labAnalyzerService.js                  # Lab equipment
└── lisService.js                          # LIS integration
```

### 17.6 Surgery & Optical Services
```
├── surgeryService.js                      # Surgery
├── ivtService.js                          # IVT operations
├── glassesOrderService.js                 # Glasses orders
├── opticalShopService.js                  # Optical shop
├── repairService.js                       # Repairs
├── warrantyService.js                     # Warranties
└── fulfillmentService.js                  # Fulfillment
```

### 17.7 Device & Imaging Services
```
├── deviceService.js                       # Devices
├── imagingService.js                      # Imaging
├── deviceImageService.js                  # Device images
├── deviceMeasurementService.js            # Measurements
└── tryOnService.js                        # Try-on photos
```

### 17.8 Integration Services
```
├── calendarService.js                     # Calendar sync
├── correspondenceService.js               # Correspondence
├── externalFacilityService.js             # External facilities
├── faceRecognitionService.js              # Face recognition
├── auditService.js                        # Audit trail
├── dashboardService.js                    # Dashboard data
├── referrerService.js                     # Referrers
├── roomService.js                         # Rooms
├── unitConversionService.js               # Unit conversions
├── ocrService.js                          # OCR operations
└── queueService.js                        # Queue operations
```

### 17.9 Core Infrastructure
```
├── core/
│   ├── cacheManager.js                    # Cache management
│   └── offlineSync.js                     # Offline sync
└── crypto/
    └── encryptionService.js               # Encryption
```

---

## PHASE 18: Frontend - Components (Priority: Critical)
*Reusable UI components - 107 files*

### 18.1 Core Components
```
frontend/src/components/
├── AccessibleModal.jsx                    # Accessible modal
├── AppointmentBookingForm.jsx             # Booking form
├── ApprovalWarningBanner.jsx              # Approval warning
├── AutoSaveIndicator.jsx                  # Auto-save indicator
├── ClinicSelector.jsx                     # Clinic selector
├── CollapsibleSection.jsx                 # Collapsible section
├── ConfirmationModal.jsx                  # Confirmation dialog
├── ConflictResolutionModal.jsx            # Conflict resolution
├── ConflictResolver.jsx                   # Conflict resolver
├── CopyPreviousButton.jsx                 # Copy previous
├── CurrencyConverter.jsx                  # Currency converter
├── DateOfBirthInput.jsx                   # DOB input
├── DigitalSignature.jsx                   # Digital signature
├── EmptyState.jsx                         # Empty state
├── ErrorBoundary.jsx                      # Error boundary
├── GlobalSearch.jsx                       # Global search
├── KeyboardShortcutsHelp.jsx              # Shortcuts help
├── LoadingSpinner.jsx                     # Loading spinner
├── MultiCurrencyPayment.jsx               # Multi-currency
├── NetworkShareBrowser.jsx                # Network browser
├── NotificationBell.jsx                   # Notifications
├── NumberInputWithArrows.jsx              # Number input
├── OfflineIndicator.jsx                   # Offline indicator
├── OfflineWarningBanner.jsx               # Offline warning
├── PermissionGate.jsx                     # Permission gate
├── PreCacheManager.jsx                    # Pre-cache manager
├── PrepareOfflineModal.jsx                # Prepare offline
├── PrintManager.jsx                       # Print manager
├── ProtectedRoute.jsx                     # Protected route
├── QuickActionsFAB.jsx                    # Quick actions FAB
├── RoleGuard.jsx                          # Role guard
├── SessionTimeoutWarning.jsx              # Session timeout
├── StatusBadge.jsx                        # Status badge
├── SyncProgressModal.jsx                  # Sync progress
├── SyncStatusBadge.jsx                    # Sync status
├── SyncStatusIndicator.jsx                # Sync indicator
├── Toast.jsx                              # Toast notifications
└── Wizard.jsx                             # Wizard component
```

### 18.2 Patient Components
```
├── PatientContextPanel.jsx                # Patient context
├── PatientPreviewCard.jsx                 # Patient preview
├── PatientSelectorModal.jsx               # Patient selector
├── PatientTimeline.jsx                    # Timeline
├── PatientRegistration/
│   ├── index.jsx                          # Registration wizard
│   ├── BiometricStep.jsx                  # Biometric step
│   ├── ContactInfoStep.jsx                # Contact step
│   ├── InsuranceStep.jsx                  # Insurance step
│   ├── MedicalHistoryStep.jsx             # Medical history
│   └── PersonalInfoStep.jsx               # Personal info
└── patients/                              # Patient components
```

### 18.3 Clinical Components
```
├── consultation/
│   └── TemplateSelector.jsx               # Template selector
├── MedicationEntryForm.jsx                # Medication entry
├── MedicationTemplateSelector.jsx         # Medication templates
├── OrthopticSummaryCard.jsx               # Orthoptic summary
├── PathologyQuickPick.jsx                 # Pathology picker
├── PrescriptionSafetyModal.jsx            # Safety modal
├── PrescriptionWarningModal.jsx           # Warning modal
├── PriorAuthorizationModal.jsx            # Prior auth
├── ProviderAvailabilityPanel.jsx          # Provider availability
├── ProviderBadge.jsx                      # Provider badge
├── QuickTreatmentBuilder.jsx              # Treatment builder
├── RefractionComparisonView.jsx           # Refraction comparison
├── prescriptions/
│   └── EnhancedPrescription.jsx           # Enhanced prescription
└── templates/
    ├── ExaminationSelector.jsx            # Exam selector
    ├── LaboratoryTestSelector.jsx         # Lab test selector
    ├── MedicationAutocomplete.jsx         # Medication autocomplete
    └── PathologyFindingSelector.jsx       # Pathology selector
```

### 18.4 Device Components
```
├── DeviceImageSelector.jsx                # Image selector
├── DeviceImageViewer.jsx                  # Image viewer
├── DeviceMeasurementSelector.jsx          # Measurement selector
└── imaging/
    └── ImageComparisonViewer.jsx          # Image comparison
```

### 18.5 Document Components
```
├── documents/
│   ├── AudioRecorder.jsx                  # Audio recording
│   ├── DocumentGenerator.jsx              # Document generation
│   ├── DocumentGeneratorIntegration.example.jsx
│   ├── DocumentManager.jsx                # Document manager
│   └── DocumentViewer.jsx                 # Document viewer
```

### 18.6 Biometric Components
```
├── biometric/
│   ├── index.js                           # Exports
│   ├── FaceVerification.jsx               # Face verification
│   ├── FacialDuplicateCheck.jsx           # Duplicate check
│   ├── PatientPhotoAvatar.jsx             # Photo avatar
│   └── WebcamCapture.jsx                  # Webcam capture
```

### 18.7 Financial Components
```
├── financial/                             # Financial components
```

### 18.8 Inventory Components
```
├── inventory/
│   ├── index.js                           # Exports
│   ├── StockAdjuster.jsx                  # Stock adjustment
│   └── StockReceiver.jsx                  # Stock receiving
```

### 18.9 Laboratory Components
```
├── laboratory/
│   └── SpecimenTracking.jsx               # Specimen tracking
```

### 18.10 Pharmacy Components
```
├── pharmacy/
│   ├── index.js                           # Exports
│   ├── BatchManager.jsx                   # Batch management
│   ├── DispenseDialog.jsx                 # Dispense dialog
│   ├── PharmacyInvoiceView.jsx            # Pharmacy invoice
│   └── ReorderPanel.jsx                   # Reorder panel
```

### 18.11 Optical Components
```
├── optical/
│   ├── index.js                           # Exports
│   ├── DepotRequestModal.jsx              # Depot request
│   ├── TryOnPhotoCapture.jsx              # Try-on capture
│   └── TryOnPhotoGallery.jsx              # Try-on gallery
```

### 18.12 Panel Components
```
├── panels/
│   ├── index.js                           # Exports
│   ├── ClinicalSummaryPanel.jsx           # Clinical summary
│   ├── MedicationChecker.jsx              # Medication checker
│   ├── PanelBase.jsx                      # Panel base
│   ├── PatientIOPHistory.jsx              # IOP history
│   └── PatientMedicalSummary.jsx          # Medical summary
```

### 18.13 Dashboard Components
```
├── dashboard/
│   ├── PendingActionsWidget.jsx           # Pending actions
│   ├── RecentPatientsWidget.jsx           # Recent patients
│   └── TodayTasksWidget.jsx               # Today's tasks
```

### 18.14 Settings Components
```
├── settings/
│   ├── CalendarIntegration.jsx            # Calendar integration
│   ├── LISIntegration.jsx                 # LIS integration
│   ├── ReferrerManagement.jsx             # Referrer management
│   ├── RolePermissionsManager.jsx         # Role permissions
│   └── TarifManagement.jsx                # Tarif management
```

### 18.15 Queue Components
```
├── queue/                                 # Queue components
```

### 18.16 Notification Components
```
├── notifications/                         # Notification components
```

### 18.17 Examples
```
├── examples/
│   └── OfflineAwareQueue.jsx              # Offline queue example
```

---

## PHASE 19: Frontend - Pages (Priority: Critical)
*Page components - 196 files*

### 19.1 Core Pages
```
frontend/src/pages/
├── Dashboard.jsx                          # Main dashboard
├── HomeDashboard.jsx                      # Home dashboard
├── AlertDashboard.jsx                     # Alert dashboard
├── AuditTrail.jsx                         # Audit trail
├── BackupManagement.jsx                   # Backup management
├── BookingConfirmation.jsx                # Booking confirmation
├── DocumentGeneration.jsx                 # Document generation
├── DeviceDetail.jsx                       # Device detail
├── DeviceImport.jsx                       # Device import
├── DeviceManager.jsx                      # Device management
└── DeviceStatusDashboard.jsx              # Device status
```

### 19.2 Appointment Pages
```
├── Appointments/
│   ├── index.jsx                          # Main appointments
│   ├── AppointmentCalendar.jsx            # Calendar view
│   ├── AppointmentFilters.jsx             # Filters
│   ├── AppointmentList.jsx                # List view
│   └── AppointmentModal.jsx               # Appointment modal
```

### 19.3 Approval Pages
```
├── Approvals/
│   ├── index.jsx                          # Main approvals
│   ├── ApprovalDetailModal.jsx            # Detail modal
│   └── ApprovalRequestModal.jsx           # Request modal
```

### 19.4 Company Pages
```
├── Companies/
│   ├── index.jsx                          # Companies list
│   ├── CompanyDetail.jsx                  # Company detail
│   ├── CompanyFormModal.jsx               # Company form
│   └── PaymentModal.jsx                   # Payment modal
```

### 19.5 Financial Pages
```
├── Financial/
│   ├── index.jsx                          # Financial dashboard
│   └── sections/
│       ├── index.js                       # Exports
│       ├── CommissionSection.jsx          # Commissions
│       ├── CompanyBalanceSection.jsx      # Company balances
│       ├── FinancialAgingSection.jsx      # Aging report
│       ├── FinancialOverviewSection.jsx   # Overview
│       ├── FinancialServiceSection.jsx    # Service revenue
│       └── OpticalShopSection.jsx         # Optical shop
├── Invoicing/
│   └── [invoicing pages]
```

### 19.6 Patient Pages
```
├── patient/
│   └── [patient pages]
├── PatientDetail/
│   ├── [main files]
│   └── sections/
│       └── ImagingSection.jsx             # Imaging section
```

### 19.7 Queue Pages
```
├── Queue/
│   ├── [queue pages]
│   └── modals/
│       └── [queue modals]
```

### 19.8 Laboratory Pages
```
├── Laboratory/
│   ├── [lab pages]
│   └── sections/
│       └── [lab sections]
```

### 19.9 Pharmacy Pages
```
├── PharmacyDashboard/
│   ├── index.jsx
│   └── sections/
│       └── [pharmacy sections]
```

### 19.10 Surgery Pages
```
├── Surgery/
│   ├── [surgery pages]
│   ├── components/
│   │   └── [surgery components]
│   └── sections/
│       └── [surgery sections]
```

### 19.11 IVT Pages
```
├── IVTDashboard/
│   ├── index.jsx
│   └── sections/
│       ├── IVTAllSection.jsx
│       ├── IVTDueSection.jsx
│       └── [other IVT sections]
```

### 19.12 Ophthalmology Pages
```
├── ophthalmology/
│   ├── [ophthalmology pages]
│   ├── config/
│   │   └── [config files]
│   └── components/
│       ├── alerts/
│       ├── gonioscopy/
│       ├── imaging/
│       ├── panels/
│       ├── pediatric/
│       └── trends/
```

### 19.13 Inventory Pages
```
├── FrameInventory/
│   ├── index.jsx
│   ├── FrameForm.jsx
│   ├── StockAdjuster.jsx
│   └── StockReceiver.jsx
├── ContactLensInventory/
│   └── index.jsx
├── OpticalLensInventory/
│   └── index.jsx
├── ReagentInventory/
│   └── index.jsx
├── LabConsumableInventory/
│   └── index.jsx
├── CrossClinicInventory/
│   └── index.jsx
├── StockReconciliation/
│   └── [stock reconciliation pages]
├── PurchaseOrders/
│   └── [purchase order pages]
```

### 19.14 Optical Shop Pages
```
├── OpticalShop/
│   └── [optical shop pages]
├── GlassesOrders/
│   ├── index.js
│   ├── GlassesOrderDelivery.jsx
│   ├── GlassesOrderDetail.jsx
│   └── GlassesOrderList.jsx
├── RepairTracking/
│   └── [repair pages]
├── WarrantyManagement/
│   └── [warranty pages]
├── DispatchDashboard/
│   └── index.jsx
```

### 19.15 Cross-Clinic Pages
```
├── CrossClinicDashboard/
│   └── index.jsx
├── ConsolidatedReports/
│   └── index.jsx
├── ExternalFacilities/
│   └── index.jsx
```

### 19.16 Analytics Pages
```
├── analytics/
│   └── [analytics pages]
```

### 19.17 Visit Pages
```
├── visits/
│   └── VisitDetail.jsx
```

### 19.18 Template Pages
```
├── templates/
│   └── [template pages]
```

---

## PHASE 20: Frontend - Modules (Priority: High)
*Feature modules - 14 files*

```
frontend/src/modules/
├── index.js                               # Module exports
├── clinical/
│   ├── index.js                           # Clinical module
│   ├── ClinicalWorkflow.jsx               # Clinical workflow
│   ├── useClinicalSession.js              # Session hook
│   ├── steps/
│   │   └── [workflow steps]
│   └── workflows/
│       └── ophthalmologyWorkflow.js       # Ophthalmology workflow
├── dashboard/
│   ├── index.js                           # Dashboard module
│   ├── DashboardContainer.jsx             # Dashboard container
│   ├── useDashboardData.js                # Dashboard hook
│   └── widgets/
│       └── StatsWidget.jsx                # Stats widget
├── patient/
│   ├── index.js                           # Patient module
│   ├── PatientSelector.jsx                # Patient selector
│   └── usePatientData.js                  # Patient hook
└── prescription/
    ├── index.js                           # Prescription module
    └── usePrescriptionSafety.js           # Safety hook
```

---

## PHASE 21: Frontend - Configuration & Data
*Static data and config - 10+ files*

```
frontend/src/config/
├── clinic.js                              # Clinic configuration
├── rolePermissions.js                     # Permission config
└── statusColors.js                        # Status colors

frontend/src/data/
├── medicationRoutes.js                    # Medication routes
├── mockData.js                            # Mock data
├── ophthalmologyData.js                   # Ophthalmology data
└── orthopticData.js                       # Orthoptic data
```

---

## PHASE 22: Frontend - Tests
*Frontend test files*

```
frontend/src/test/
├── components/
├── contexts/
├── integration/
├── mocks/
└── services/
    └── __tests__/
```

---

## PHASE 23: Central Server (Priority: High)
*Multi-clinic synchronization hub - 19 files*

```
central-server/
├── server.js                              # Server entry
├── package.json                           # Dependencies
├── models/
│   ├── CentralInventory.js                # Inventory model
│   ├── CentralInvoice.js                  # Invoice model
│   ├── CentralPatient.js                  # Patient model
│   ├── CentralVisit.js                    # Visit model
│   └── ClinicRegistry.js                  # Clinic registry
├── controllers/
│   ├── financialController.js             # Financial sync
│   ├── inventoryController.js             # Inventory sync
│   ├── patientController.js               # Patient sync
│   └── syncController.js                  # Sync operations
├── middleware/
│   ├── clinicAuth.js                      # Clinic auth
│   └── errorHandler.js                    # Error handling
├── routes/
│   ├── clinics.js                         # Clinic routes
│   ├── inventory.js                       # Inventory routes
│   ├── patients.js                        # Patient routes
│   ├── reports.js                         # Report routes
│   └── sync.js                            # Sync routes
└── scripts/
    ├── manageClinics.js                   # Clinic management
    └── registerClinic.js                  # Clinic registration
```

---

## PHASE 24: OCR Service (Priority: Medium)
*Python OCR processing service - 12 files*

```
ocr-service/
├── requirements.txt                       # Dependencies
├── Dockerfile                             # Docker config
├── app/
│   ├── __init__.py                        # Package init
│   ├── main.py                            # FastAPI entry
│   ├── celery_app.py                      # Celery config
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py                     # Pydantic schemas
│   ├── routers/
│   │   ├── __init__.py
│   │   └── ocr.py                         # OCR endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ocr_service.py                 # OCR processing
│   │   └── file_scanner.py                # File scanning
│   ├── tasks/
│   │   ├── __init__.py
│   │   └── ocr_tasks.py                   # Celery tasks
│   └── utils/
│       └── [utility files]
└── tests/
    └── [test files]
```

---

## PHASE 25: Face Service (Priority: Medium)
*Python face recognition service*

```
face-service/
├── requirements.txt                       # Dependencies
├── Dockerfile                             # Docker config
├── app/
│   ├── main.py                            # FastAPI entry
│   └── [service files]
└── venv/                                  # Virtual environment
```

---

## PHASE 26: Playwright E2E Tests (Priority: Medium)
*End-to-end test suites - 16 files*

```
tests/playwright/
├── test_all_pages.py                      # All pages test
├── test_complete_screenshots.py           # Screenshot tests
├── test_comprehensive.py                  # Comprehensive tests
├── test_data_coherence.py                 # Data coherence
├── test_patient_journey_e2e.py            # Patient journey
├── test_workflows.py                      # Workflow tests
├── test_extended_workflows_e2e.py         # Extended workflows
├── test_full_patient_journey_e2e.py       # Full journey
├── test_deep_business_logic_e2e.py        # Business logic
├── test_crud_verification_e2e.py          # CRUD verification
├── test_cascade_verification_e2e.py       # Cascade verification
├── test_convention_calculations_e2e.py    # Convention calculations
├── test_complete_workflow_e2e.py          # Complete workflow
├── test_verified_systems_e2e.py           # Verified systems
├── test_cascade_architecture_e2e.py       # Architecture cascade
└── test_approval_workflow_e2e.py          # Approval workflow
```

---

## Analysis Execution Strategy

### Execution Order
1. **Phase 1-2**: Foundation (Config + Models) - Understand data structures
2. **Phase 3-5**: Backend Core (Routes + Controllers + Services) - Understand business logic
3. **Phase 6-8**: Backend Support (Middleware + Utils + Validators) - Understand infrastructure
4. **Phase 9-12**: Backend Scripts & Tests - Understand maintenance/setup
5. **Phase 13-16**: Frontend Core (Entry + Contexts + Hooks + Store) - Understand state management
6. **Phase 17**: Frontend Services - Understand API integration
7. **Phase 18-19**: Frontend UI (Components + Pages) - Understand user interface
8. **Phase 20-22**: Frontend Support (Modules + Config + Tests) - Understand feature organization
9. **Phase 23**: Central Server - Understand multi-clinic sync
10. **Phase 24-25**: Python Services (OCR + Face) - Understand external services
11. **Phase 26**: E2E Tests - Understand expected behaviors

### Analysis Deliverables
For each file analyzed, document:
1. **Purpose**: What the file does
2. **Dependencies**: What it imports/requires
3. **Exports**: What it provides to other files
4. **Key Functions**: Main functions/methods
5. **Data Flow**: How data moves through it
6. **Integration Points**: How it connects to other files
7. **Issues/Concerns**: Any problems or technical debt noticed

### Parallel Analysis Strategy
To maximize efficiency, multiple agents can analyze in parallel:
- **Agent 1**: Backend Models
- **Agent 2**: Backend Controllers
- **Agent 3**: Backend Services
- **Agent 4**: Frontend Services
- **Agent 5**: Frontend Components
- **Agent 6**: Frontend Pages

---

## File Count Summary

| Category | File Count |
|----------|------------|
| Backend Models | 83 |
| Backend Controllers | 77 |
| Backend Routes | 76 |
| Backend Services | 71 |
| Backend Scripts | 124 |
| Backend Middleware | 12 |
| Backend Utils | 16 |
| Backend Config | 7 |
| Backend Tests | 13 |
| Backend Windows Agent | 4 |
| Backend Data Files | 3 |
| Frontend Components | 107 |
| Frontend Pages | 196 |
| Frontend Services | 85 |
| Frontend Hooks | 17 |
| Frontend Contexts | 5 |
| Frontend Modules | 14 |
| Frontend Store | 12 |
| Frontend Config/Data | 10 |
| Central Server | 19 |
| OCR Service | 12 |
| Playwright Tests | 16 |
| **TOTAL** | **~980 files** |

---

## Next Steps

To execute this plan:
1. Approve this plan
2. Choose execution mode:
   - **Sequential**: Read files one by one (thorough but slow)
   - **Parallel**: Launch multiple agents (faster but requires coordination)
3. Specify analysis depth:
   - **Overview**: Purpose + key exports only
   - **Standard**: All deliverables listed above
   - **Deep**: Include line-by-line analysis of critical sections

**Awaiting your approval to begin execution.**
