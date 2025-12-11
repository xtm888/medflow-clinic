# MedFlow API Endpoints Documentation

## Overview

MedFlow exposes a comprehensive RESTful API built with **Express.js**. The API includes **63 route files** organized by domain, with consistent patterns for authentication, authorization, validation, and audit logging.

### Base URL
```
http://localhost:5001/api
```

### API Design Patterns

1. **Authentication**: JWT Bearer tokens via `protect` middleware
2. **Authorization**: Role-based (`authorize`) and permission-based (`requirePermission`)
3. **Multi-Clinic**: `optionalClinic` middleware for clinic context
4. **Audit Logging**: `logAction` for general, `logCriticalOperation` for financial/sensitive
5. **Response Format**: `{ success: boolean, data?: any, error?: string }`
6. **Pagination**: `?page=1&limit=20&sort=-createdAt`

---

## 1. Authentication & Authorization

### `/api/auth` - Authentication Routes

| Method | Endpoint | Description | Auth | Audit |
|--------|----------|-------------|------|-------|
| POST | `/register` | Register new user (first user or admin) | Rate Limited | - |
| POST | `/login` | User login | Rate Limited | - |
| POST | `/refresh` | Refresh access token | Rate Limited | - |
| POST | `/logout` | Logout user | Protected | LOGOUT |
| GET | `/me` | Get current user profile | Protected | - |
| PUT | `/updatedetails` | Update user details | Protected | USER_UPDATE |
| PUT | `/updatepassword` | Change password | Protected | PASSWORD_CHANGE |
| POST | `/forgotpassword` | Request password reset | Rate Limited | - |
| PUT | `/resetpassword/:resettoken` | Reset password with token | Public | - |
| GET | `/verifyemail/:token` | Verify email address | Public | - |

**Two-Factor Authentication:**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/enable-2fa` | Start 2FA setup | Protected |
| POST | `/verify-2fa-setup` | Complete 2FA setup | Protected |
| POST | `/verify-2fa` | Verify 2FA during login | Rate Limited |
| POST | `/disable-2fa` | Disable 2FA | Protected |
| POST | `/regenerate-backup-codes` | Generate new backup codes | Protected |

---

## 2. Patient Management

### `/api/patients` - Patient CRUD & Sub-resources

**Core Operations:**

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/` | List patients (paginated) | `view_patients` |
| POST | `/` | Create patient | `register_patients` |
| GET | `/:id` | Get patient by ID | `view_patients` |
| PUT | `/:id` | Update patient | `manage_patients` |
| DELETE | `/:id` | Soft delete patient | `delete_patients` |

**Search & Discovery:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?q=term` | Search patients by name/ID |
| GET | `/recent` | Recently viewed patients |
| GET | `/advanced-search` | Multi-field search |
| POST | `/check-duplicates` | Check for duplicate registrations |
| POST | `/merge` | Merge duplicate patients |
| GET | `/mrn/:mrn` | Find by Medical Record Number |
| POST | `/batch` | Batch fetch by IDs (max 50) |

**Patient Sub-resources:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/history` | Medical history |
| GET | `/:id/visits` | All visits |
| GET | `/:id/appointments` | All appointments |
| GET | `/:id/prescriptions` | All prescriptions |
| GET | `/:id/billing` | Billing summary |
| GET | `/:id/lab-results` | Laboratory results |
| GET | `/:id/correspondence` | Letters/communications |
| GET | `/:id/complete-profile` | Full patient profile |
| GET | `/:id/statistics` | Visit/billing stats |
| GET | `/:id/audit` | Audit trail |
| GET | `/:id/record/pdf` | Export patient record PDF |

**Allergies Management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/allergies` | List allergies |
| POST | `/:id/allergies` | Add allergy |
| PUT | `/:id/allergies/:allergyId` | Update allergy |
| DELETE | `/:id/allergies/:allergyId` | Remove allergy |

**Insurance Management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/insurance` | Get insurance info |
| PUT | `/:id/insurance` | Update insurance |

**Legacy Integration:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search/legacy/:legacyId` | Search by legacy ID |
| GET | `/with-legacy-data` | Patients with legacy links |
| POST | `/:id/link-folder` | Link legacy folder |
| DELETE | `/:id/unlink-folder/:folderId` | Unlink folder |

---

## 3. Visit Management

### `/api/visits` - Clinical Visits

**Core Operations:**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create visit | Doctor/Nurse |
| GET | `/:id` | Get visit with related data | Protected |
| PUT | `/:id` | Update visit | Doctor/Nurse |

**Workflow Actions:**

| Method | Endpoint | Description | Audit |
|--------|----------|-------------|-------|
| PUT | `/:id/complete` | Complete visit (cascade) | VISIT_COMPLETE |
| PUT | `/:id/sign` | Doctor signature | VISIT_SIGN |
| PUT | `/:id/lock` | Lock visit | VISIT_LOCK |

**Clinical Data:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/acts` | Add clinical act |
| PUT | `/:id/acts/:actId` | Update clinical act |
| POST | `/:id/documents` | Add document |
| GET | `/:id/billing` | Get billing info |
| GET | `/:id/calculate-copay` | Calculate insurance copay |
| GET | `/:id/summary` | Complete visit summary |
| POST | `/:id/invoice` | Generate invoice |

**Timeline & Statistics:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/today` | Today's visits |
| GET | `/stats` | Visit statistics |
| GET | `/timeline/:patientId` | Patient timeline (visits, rx, labs) |

---

## 4. Appointment Scheduling

### `/api/appointments` - Scheduling System

**Core Operations:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List appointments |
| POST | `/` | Create appointment |
| GET | `/:id` | Get appointment |
| PUT | `/:id` | Update appointment |

**Status Actions:**

| Method | Endpoint | Description | Audit |
|--------|----------|-------------|-------|
| PUT | `/:id/cancel` | Cancel appointment | APPOINTMENT_CANCEL |
| PUT | `/:id/checkin` | Check-in patient | - |
| PUT | `/:id/start-consultation` | Begin consultation | CONSULTATION_START |
| PUT | `/:id/complete` | Complete | - |
| PUT | `/:id/reschedule` | Reschedule | APPOINTMENT_RESCHEDULE |
| PUT | `/:id/no-show` | Mark no-show | APPOINTMENT_NO_SHOW |
| PUT | `/:id/confirm` | Confirm appointment | APPOINTMENT_CONFIRM |

**Scheduling Views:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/today` | Today's appointments |
| GET | `/upcoming` | Upcoming appointments |
| GET | `/calendar` | Calendar view |
| GET | `/available-slots` | Available time slots |
| GET | `/statistics` | Appointment statistics |

**Provider Management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/providers` | List providers |
| GET | `/provider/:providerId` | Provider's appointments |
| GET | `/provider-availability/:providerId` | Provider availability |
| PUT | `/provider-availability/:providerId` | Update availability |
| POST | `/provider-availability/:providerId/time-off` | Add time off |

**Waiting List:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/waiting-list` | Get waiting list |
| POST | `/waiting-list` | Add to waiting list |
| DELETE | `/waiting-list/:id` | Remove from list |

**Recurring Appointments:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recurring` | Create recurring series |
| GET | `/series/:seriesId` | Get recurring series |

---

## 5. Queue Management

### `/api/queue` - Real-time Queue

| Method | Endpoint | Description | Auth | Audit |
|--------|----------|-------------|------|-------|
| GET | `/display-board` | Public display (rate limited) | Public | - |
| GET | `/` | Current queue | Protected | QUEUE_VIEW |
| POST | `/` | Add to queue | `manage_queue` | QUEUE_ADD |
| PUT | `/:id` | Update queue entry | `manage_queue` | QUEUE_UPDATE |
| DELETE | `/:id` | Remove from queue | `manage_queue` | QUEUE_REMOVE |
| POST | `/next` | Call next patient | `manage_queue` | QUEUE_CALL_NEXT |
| POST | `/:id/call` | Call specific patient | `manage_queue` | QUEUE_CALL_PATIENT |
| GET | `/stats` | Queue statistics | Protected | QUEUE_STATS_VIEW |
| GET | `/analytics` | Queue analytics | `view_reports` | QUEUE_ANALYTICS_VIEW |

---

## 6. Ophthalmology

### `/api/ophthalmology` - Eye Examinations

**Exam CRUD:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/exams` | List exams |
| POST | `/exams` | Create exam |
| GET | `/exams/:id` | Get exam |
| PUT | `/exams/:id` | Update exam |
| DELETE | `/exams/:id` | Delete exam (admin) |
| PUT | `/exams/:id/complete` | Complete exam |

**Specialized Test Data:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/exams/:id/refraction` | Save refraction |
| PUT | `/exams/:id/tonometry` | Save tonometry |
| PUT | `/exams/:id/visual-acuity` | Save visual acuity |
| PUT | `/exams/:id/oct` | Save OCT results |
| PUT | `/exams/:id/visual-field` | Save visual field |
| PUT | `/exams/:id/keratometry` | Save keratometry |
| PUT | `/exams/:id/biometry` | Save biometry |
| PUT | `/exams/:id/slit-lamp` | Save slit lamp |
| PUT | `/exams/:id/fundoscopy` | Save fundoscopy |
| PUT | `/exams/:id/diagnosis` | Save diagnosis |

**Device Integration:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/exams/:id/available-measurements` | Available device data |
| POST | `/exams/:id/link-measurement` | Link measurement |
| POST | `/exams/:id/apply-measurement` | Apply to exam |
| POST | `/exams/:id/link-image` | Link device image |
| GET | `/exams/:id/device-measurements` | Linked measurements |
| GET | `/exams/:id/device-images` | Linked images |
| POST | `/exams/:id/import-device` | Import device data |

**Prescriptions & IOL:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/exams/:id/prescription` | Generate optical Rx |
| POST | `/exams/:id/iol-calculation` | Calculate IOL power |
| POST | `/exams/:id/generate-refraction-summary` | Refraction summary |
| POST | `/exams/:id/generate-keratometry-summary` | Keratometry summary |

**Patient History & Analysis:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients/:patientId/history` | Exam history |
| GET | `/patients/:patientId/refraction-history` | Refraction history |
| GET | `/patients/:patientId/progression` | Progression analysis |
| GET | `/patients/:patientId/treatment-recommendations` | Treatment recommendations |
| POST | `/exams/compare` | Compare exams |

---

## 7. Prescriptions

### `/api/prescriptions` - Medication & Optical Prescriptions

**Core Operations:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List prescriptions |
| POST | `/` | Create prescription |
| GET | `/:id` | Get prescription |
| PUT | `/:id` | Update prescription |
| DELETE | `/:id` | Delete prescription |

**Type-Specific:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/optical` | Optical prescriptions |
| POST | `/optical` | Create optical Rx |
| PUT | `/optical/:id` | Update optical Rx |
| GET | `/drug` | Drug prescriptions |
| POST | `/drug` | Create drug Rx |
| POST | `/bulk` | Bulk create |

**Workflow Actions:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/:id/cancel` | Cancel prescription |
| PUT | `/:id/sign` | Doctor signature |
| PUT | `/:id/dispense` | Mark dispensed |
| POST | `/:id/verify` | Pharmacist verify |
| POST | `/:id/invoice` | Create invoice |
| POST | `/:id/send-to-pharmacy` | Send to pharmacy |
| PUT | `/:id/pharmacy-status` | Update pharmacy status |

**Safety Checks:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/check-interactions` | Drug interaction check |
| POST | `/safety-check` | Full safety check |
| POST | `/validate` | Validate prescription |
| POST | `/create-with-override` | Create with safety override |
| GET | `/drug-safety/status` | Drug safety service status |

**Refills & Renewals:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/renew` | Renew prescription |
| POST | `/:id/refill` | Refill prescription |
| GET | `/:id/refill-history` | Refill history |

**E-Prescribing (NCPDP):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/e-prescribe` | Transmit e-prescription |
| GET | `/:id/e-prescribe/status` | E-Rx status |
| POST | `/:id/e-prescribe/cancel` | Cancel e-Rx |
| GET | `/e-prescribing/pharmacies` | Search pharmacies |
| GET | `/e-prescribing/status` | Service status |

**Prior Authorization:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/prior-auth/request` | Request prior auth |
| PUT | `/:id/prior-auth/update` | Update prior auth |
| GET | `/:id/prior-auth/status` | Prior auth status |
| GET | `/prior-auth/pending` | Pending authorizations |

---

## 8. Invoicing & Billing

### `/api/invoices` - Invoice Management

**Core Operations:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List invoices |
| POST | `/` | Create invoice |
| GET | `/:id` | Get invoice |
| PUT | `/:id` | Update invoice |
| DELETE | `/:id` | Delete invoice (admin) |

**Actions:**

| Method | Endpoint | Description | Audit |
|--------|----------|-------------|-------|
| POST | `/:id/payments` | Record payment | PAYMENT_ADD |
| PUT | `/:id/cancel` | Cancel invoice | INVOICE_CANCEL |
| POST | `/:id/refund` | Issue refund | INVOICE_REFUND |
| POST | `/:id/reminder` | Send reminder | - |
| PUT | `/:id/send` | Mark as sent | - |
| POST | `/:id/apply-discount` | Apply discount | DISCOUNT_APPLY |
| POST | `/:id/write-off` | Write off balance | WRITE_OFF |

**Convention/Insurance:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/preview-company-billing` | Preview coverage |
| POST | `/:id/apply-company-billing` | Apply company billing |
| POST | `/:id/consume-approvals` | Consume approvals |

**Reporting:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Invoice statistics |
| GET | `/overdue` | Overdue invoices |
| GET | `/payments` | Payment history |
| GET | `/patient/:patientId` | Patient's invoices |
| GET | `/:id/history` | Invoice audit trail |
| GET | `/:id/pdf` | Generate PDF |
| GET | `/:id/receipt/:paymentIndex` | Generate receipt |

### `/api/billing` - Advanced Billing

**Statistics & Reports:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/statistics` | Billing statistics |
| GET | `/reports/revenue` | Revenue report |
| GET | `/reports/aging` | Aging report |
| GET | `/reports/aging/by-patient` | Aging by patient |
| GET | `/reports/aging/trend` | Aging trend |
| GET | `/reports/daily-reconciliation` | Daily reconciliation |
| GET | `/outstanding-balances` | Outstanding balances |

**Fee Schedule:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fee-schedule` | Get fee schedule |
| POST | `/fee-schedule` | Create fee item |
| PUT | `/fee-schedule/:id` | Update fee item |
| DELETE | `/fee-schedule/:id` | Delete fee item |
| GET | `/fee-schedule/effective-price/:code` | Effective price |
| POST | `/fee-schedule/validate-price` | Validate price |
| GET | `/fee-schedule/expired` | Expired items |
| GET | `/fee-schedule/upcoming-changes` | Upcoming changes |

**Multi-Currency:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/currency/rates` | Exchange rates |
| GET | `/currency/supported` | Supported currencies |
| POST | `/currency/convert` | Convert amount |
| POST | `/currency/calculate-total` | Multi-currency total |
| POST | `/currency/parse-payment` | Parse payment string |
| GET | `/invoices/:invoiceId/amount-due-currencies` | Amount in currencies |
| POST | `/invoices/:invoiceId/multi-currency-payment` | Multi-currency payment |

**Payment Plans:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payment-plans` | List payment plans |
| POST | `/payment-plans` | Create plan |
| GET | `/payment-plans/:id` | Get plan |
| POST | `/payment-plans/:id/activate` | Activate plan |
| POST | `/payment-plans/:id/pay` | Record installment |
| POST | `/payment-plans/:id/cancel` | Cancel plan |
| GET | `/payment-plans/overdue` | Overdue installments |
| PUT | `/payment-plans/:id/auto-charge` | Configure auto-charge |

**Insurance Claims:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/claims` | List claims |
| POST | `/claims` | Create claim |
| GET | `/claims/:id` | Get claim |
| POST | `/claims/:id/submit` | Submit claim |
| POST | `/claims/:id/approve` | Approve claim |
| POST | `/claims/:id/deny` | Deny claim |
| POST | `/claims/:id/mark-paid` | Mark paid |
| GET | `/claims/:id/pdf` | Generate PDF |

**Patient Credit:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/credits` | Patients with credit |
| GET | `/patients/:patientId/credit` | Patient credit balance |
| POST | `/patients/:patientId/credit` | Add credit |
| POST | `/patients/:patientId/credit/apply` | Apply credit |

**Convention Billing:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/convention/apply/:invoiceId` | Apply convention |
| GET | `/convention/invoices` | Convention invoices |
| GET | `/convention/summary/:companyId` | Company summary |
| GET | `/convention/statement/:companyId` | Generate statement |
| GET | `/convention/price` | Convention pricing |
| POST | `/realize/:invoiceId/item/:itemIndex` | Mark item realized |
| POST | `/realize/:invoiceId/all` | Mark all realized |

---

## 9. Company/Convention Management

### `/api/companies` - Convention/Insurance Companies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List companies |
| POST | `/` | Create company |
| GET | `/:id` | Get company |
| PUT | `/:id` | Update company |
| DELETE | `/:id` | Delete company |
| GET | `/search` | Search companies |
| GET | `/hierarchy` | Hierarchy view |
| GET | `/expiring-contracts` | Expiring contracts |
| GET | `/with-outstanding` | With outstanding balance |

**Financial:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/financial-dashboard` | Financial dashboard |
| GET | `/aging-report` | Aging report |
| GET | `/:id/invoices` | Company invoices |
| GET | `/:id/statement` | Account statement |
| POST | `/:id/payments` | Record payment |
| GET | `/:id/payment-history` | Payment history |
| GET | `/:id/stats` | Company statistics |
| GET | `/:id/unrealized-items` | Unrealized items |
| POST | `/:id/generate-batch-invoice` | Generate bordereau |

**Coverage:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/fee-schedule` | Company fee schedule |
| PUT | `/:id/fee-schedule` | Update fee schedule |
| POST | `/:id/preview-coverage` | Preview coverage |
| GET | `/:id/patient/:patientId/remaining-coverage` | Patient remaining coverage |
| GET | `/:id/approvals` | Company approvals |
| GET | `/:id/employees` | Company employees |

---

## 10. Pharmacy

### `/api/pharmacy` - Pharmacy Inventory

**Inventory:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory` | List inventory |
| POST | `/inventory` | Add medication |
| GET | `/inventory/:id` | Get medication |
| PUT | `/inventory/:id` | Update medication |
| DELETE | `/inventory/:id` | Delete medication |
| POST | `/inventory/:id/adjust` | Adjust stock |
| GET | `/search` | Search medications |

**Stock Alerts:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Inventory statistics |
| GET | `/alerts` | Active alerts |
| GET | `/low-stock` | Low stock items |
| GET | `/expiring` | Expiring items |
| GET | `/value` | Inventory value |
| GET | `/profit-margins` | Profit margins |

**Batch Management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/:id/batches` | List batches |
| POST | `/inventory/:id/batches` | Add batch |
| PUT | `/inventory/:id/batches/:lotNumber` | Update batch |
| POST | `/inventory/:id/batches/:lotNumber/expire` | Mark expired |

**Dispensing:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/inventory/:id/dispense` | Dispense from inventory |
| POST | `/dispense` | Dispense prescription |

**Reservations:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reserve` | Reserve for prescription |
| POST | `/inventory/:id/reserve` | Reserve specific item |
| POST | `/inventory/:id/release` | Release reservation |

---

## 11. Laboratory

### `/api/laboratory` - Lab Tests & Results

**Templates:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates` | List templates |
| POST | `/templates` | Create template |
| GET | `/templates/:id` | Get template |
| PUT | `/templates/:id` | Update template |
| DELETE | `/templates/:id` | Delete template |

**Test Orders:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tests` | All tests |
| POST | `/tests` | Order tests |
| GET | `/pending` | Pending tests |
| GET | `/completed` | Completed tests |

**Results:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/tests/:visitId/:testId` | Update results |
| PUT | `/tests/:visitId/:testId/results` | Enter results |
| GET | `/tests/:visitId/:testId/results` | Get results |
| POST | `/validate-result` | Validate result |
| POST | `/check-abnormal` | Check abnormal values |

**Specimens:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/specimens` | Register specimen |
| GET | `/specimens` | All specimens |
| GET | `/specimens/barcode/:barcode` | Find by barcode |
| GET | `/specimens/:specimenId` | Get specimen |
| PUT | `/specimens/:specimenId` | Update status |

**Worklist:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/worklist` | Tech worklist |
| PUT | `/worklist/:testId/collect` | Mark collected |
| PUT | `/worklist/:testId/start` | Start processing |

**Reports:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/report/:visitId` | Generate report |
| GET | `/report/:visitId/pdf` | PDF report |
| GET | `/stats` | Statistics |
| GET | `/stats/turnaround` | Turnaround time |

### `/api/lab-orders` - Lab Order Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List lab orders |
| POST | `/` | Create order |
| GET | `/:id` | Get order |
| PUT | `/:id` | Update order |
| POST | `/:id/collect` | Collect specimen |
| POST | `/:id/receive` | Receive specimen |
| POST | `/:id/check-in` | Patient check-in |
| POST | `/:id/reject` | Reject & reschedule |
| GET | `/scheduled-today` | Today's schedule |
| GET | `/checked-in` | Checked-in patients |

---

## 12. Surgery

### `/api/surgery` - Surgical Case Management

**Queue & Dashboard:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/queue/awaiting` | Awaiting scheduling |
| GET | `/queue/overdue` | Overdue cases |
| GET | `/types` | Surgery types |

**OR Room Scheduling:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rooms` | List OR rooms |
| GET | `/rooms/available` | Available rooms |
| GET | `/rooms/:roomId/schedule` | Room schedule |
| GET | `/agenda` | Full agenda |

**Case Management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cases` | List cases |
| POST | `/cases` | Create case |
| GET | `/:id` | Get case |
| POST | `/:id/schedule` | Schedule case |
| POST | `/:id/reschedule` | Reschedule |
| POST | `/:id/cancel` | Cancel case |

**Surgical Workflow:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/checkin/ready` | Ready for check-in |
| POST | `/:id/checkin` | Check-in patient |
| GET | `/:id/clinical-background` | Clinical data |
| PUT | `/:id/preop-checklist` | Update checklist |
| POST | `/:id/start` | Start surgery |
| POST | `/:id/consumables` | Add consumables |

**Surgery Reports:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/report` | Create report |
| GET | `/report/:reportId` | Get report |
| PUT | `/report/:reportId` | Update report |
| POST | `/report/:reportId/finalize` | Finalize & sign |
| POST | `/report/:reportId/specimen` | Add specimen |
| GET | `/report/:reportId/specimens` | Get specimens |

**Surgeon Dashboard:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/surgeon/schedule` | Surgeon's schedule |
| GET | `/surgeon/checked-in` | Checked-in patients |
| GET | `/surgeon/drafts` | Draft reports |
| GET | `/surgeon/pending-pathology` | Pending pathology |

---

## 13. Device Integration

### `/api/devices` - Medical Device Management

**Core Operations:**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/webhook/:deviceId` | Device webhook | Signature |
| GET | `/` | List devices | Protected |
| POST | `/` | Create device | Admin |
| GET | `/:id` | Get device | Protected |
| PUT | `/:id` | Update device | Admin |
| DELETE | `/:id` | Delete device | Admin |

**Folder Sync:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/sync-folder` | Sync device folder |
| POST | `/:id/import-measurements` | Import measurements |
| GET | `/folder-sync/stats` | Sync statistics |
| POST | `/index-folders` | Index all folders |
| GET | `/index-folders/stats` | Index statistics |
| GET | `/index-folders/unmatched` | Unmatched folders |
| POST | `/index-folders/link` | Manual link |

**SMB2 Integration (No Mount):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/smb2/stats` | SMB2 statistics |
| GET | `/:id/smb2/test` | Test connection |
| GET | `/:id/smb2/browse` | Browse files |
| GET | `/:id/smb2/file/*` | Read file |
| POST | `/:id/smb2/scan` | Scan folders |

**Streaming Access:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stream/check-all` | Check all devices |
| POST | `/stream/clear-cache` | Clear cache |
| GET | `/:id/stream/check` | Check access |
| GET | `/:id/stream/browse` | Browse files |
| GET | `/:id/stream/file/*` | Stream file |

**Network Discovery:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/discover-network` | Discover SMB shares |
| GET | `/discovery/network-info` | Network info |
| GET | `/discovery/status` | Discovery status |
| POST | `/discovery/quick-scan` | Quick scan |
| POST | `/discovery/create-devices` | Create from discovery |

**Auto-Sync Service:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auto-sync/status` | Service status |
| POST | `/auto-sync/start` | Start service |
| POST | `/auto-sync/stop` | Stop service |
| POST | `/auto-sync/sync-all` | Sync all devices |
| PUT | `/auto-sync/config` | Update config |

**Sync Queue:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sync-queue/status` | Queue status |
| POST | `/sync-queue/jobs` | Add job |
| GET | `/sync-queue/jobs/:jobId` | Get job |
| POST | `/sync-queue/retry-failed` | Retry failed |
| DELETE | `/sync-queue/failed` | Clear failed |

---

## 14. Face Recognition

### `/api/face-recognition` - Biometric Integration

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Service health | Protected |
| POST | `/detect` | Detect faces | Doctor/Nurse/Reception |
| POST | `/check-duplicates` | Check duplicates | Doctor/Nurse/Reception |
| POST | `/enroll/:patientId` | Enroll face | Doctor/Nurse/Reception |
| POST | `/verify/:patientId` | Verify identity | Protected |
| DELETE | `/encoding/:patientId` | Remove encoding (GDPR) | Admin |
| GET | `/stats` | Statistics | Admin |

---

## 15. Multi-Clinic & Sync

### `/api/clinics` - Clinic Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List clinics |
| POST | `/` | Create clinic |
| GET | `/:id` | Get clinic |
| PUT | `/:id` | Update clinic |
| DELETE | `/:id` | Delete clinic |
| GET | `/:id/stats` | Clinic statistics |
| GET | `/:id/staff` | Clinic staff |

### `/api/sync` - Data Synchronization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Sync status |
| POST | `/push` | Push changes |
| POST | `/pull` | Pull changes |
| GET | `/queue` | Sync queue |
| POST | `/resolve-conflict` | Resolve conflict |

### `/api/central` - Central Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients/search` | Cross-clinic patient search |
| GET | `/reports/consolidated` | Consolidated reports |
| POST | `/patients/transfer` | Transfer patient |

---

## 16. Supporting APIs

### `/api/users` - User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List users |
| POST | `/` | Create user |
| GET | `/:id` | Get user |
| PUT | `/:id` | Update user |
| DELETE | `/:id` | Deactivate user |
| PUT | `/:id/permissions` | Update permissions |
| GET | `/:id/activity` | Activity log |

### `/api/audit` - Audit Trail

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List audit logs |
| GET | `/patient/:patientId` | Patient audit trail |
| GET | `/user/:userId` | User audit trail |
| GET | `/stats` | Audit statistics |

### `/api/dashboard` - Dashboard Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Dashboard statistics |
| GET | `/today` | Today's summary |
| GET | `/revenue` | Revenue summary |
| GET | `/appointments` | Appointment summary |

### `/api/settings` - System Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get settings |
| PUT | `/:key` | Update setting |
| GET | `/clinic` | Clinic settings |
| PUT | `/clinic` | Update clinic settings |

### `/api/health` - Health Checks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Basic health | Public |
| GET | `/ready` | Readiness check | Public |
| GET | `/live` | Liveness check | Public |
| GET | `/detailed` | Detailed status | Admin |

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/api/auth/*` | 10 req/15min |
| `/api/queue/display-board` | 30 req/min |
| General API | 100 req/min |

---

## Webhook Endpoints

**Public webhooks (verified by signature):**

| Endpoint | Provider |
|----------|----------|
| `/api/devices/webhook/:deviceId` | Medical devices |
| `/api/billing/webhook/:provider` | Payment gateways |

---

*Document generated: Phase 3 of MedFlow Documentation*
*Next: Phase 4 - Backend Services & Integrations*
