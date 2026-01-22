# MedFlow

## What This Is

MedFlow is a production ophthalmology Electronic Medical Records (EMR) and practice management system for Matrix Eye Clinic in Kinshasa, Congo (DRC). It manages patient records, clinical consultations (StudioVision), appointments, billing, pharmacy, optical shop, surgery scheduling, and device integrations. The system has 50,678 patients and 29,392 appointments migrated from the legacy CareVision system.

## Core Value

**Doctors complete consultations and billing in one seamless flow** — from patient check-in through exam documentation to invoice generation, without switching contexts or losing data.

## Requirements

### Validated

<!-- Existing capabilities confirmed working in production -->

- ✓ **Patient Management** — 50K+ patients imported, search, registration, demographics — existing
- ✓ **CareVision Data Migration** — Legacy patient data, appointments, images imported — existing
- ✓ **Multi-Clinic Architecture** — Clinic context isolation, data scoping — existing
- ✓ **Authentication & RBAC** — JWT auth, roles (doctor, nurse, optician, pharmacist, cashier, admin) — existing
- ✓ **Appointment Scheduling** — Calendar, booking, check-in, queue management — existing
- ✓ **StudioVision Consultation UI** — Color-coded exam interface, refraction, IOP, anterior/posterior segment — existing
- ✓ **Ophthalmology Exams** — Visual acuity (Monoyer/Parinaud), refraction storage — existing
- ✓ **Pharmacy Module** — Drug inventory, dispensing workflow — existing
- ✓ **Optical Shop** — Frames, lenses, glasses orders — existing
- ✓ **Device Integration** — DICOM, SMB folder monitoring, OCT, autorefractor, tonometer parsers — existing
- ✓ **Invoice/Billing Models** — Invoice data structure, payment tracking — existing
- ✓ **WebSocket Real-time Updates** — Queue updates, notifications — existing
- ✓ **Audit Logging** — Sensitive operation tracking — existing
- ✓ **Offline Capability** — Dexie IndexedDB, sync queue — existing

### Active

<!-- Current scope: What needs to be fixed/completed for production -->

- [ ] **BILL-01**: Consultation completion auto-finalizes invoice (not left as draft)
- [ ] **BILL-02**: Convention billing calculates and commits in single flow
- [ ] **BILL-03**: Lab orders automatically link to invoice
- [ ] **UX-01**: Auto-save consultation data with unsaved changes warning
- [ ] **UX-02**: Tab navigation preserves data (no loss on switch)
- [ ] **UX-03**: Consolidate 4 refraction components into 1 canonical implementation
- [ ] **UX-04**: Reduce consultation completion clicks from 9-13 to 5-8
- [ ] **FIX-01**: Resolve PDFQueue errors in production logs
- [ ] **FIX-02**: Fix "Unknown entity" warnings on startup
- [ ] **FIX-03**: CareVision images display in Imaging gallery
- [ ] **FIX-04**: Redis connection or proper memory fallback without errors
- [ ] **DATA-01**: Verify all CareVision consultation/refraction data accessible
- [ ] **DATA-02**: Device data (DICOM, parsers) displays in patient timeline
- [ ] **DEPLOY-01**: Production deployment stability (service stays running)

### Out of Scope

- **Mobile App** — Web-first, mobile later
- **Multi-language** — French only for v1
- **External Lab Integration (HL7)** — Defer to v2
- **Advanced Analytics Dashboards** — Basic reporting sufficient for v1
- **Patient Portal** — Staff-only access for v1

## Context

**Production Environment:**
- Server: SERVEUR (100.70.189.114 via Tailscale, Windows 10)
- Backend: Node.js 20.11.0, Express, port 5002
- Database: MongoDB 7.0.5, 27017 (standalone, no replica set)
- Redis: Not running (using memory fallback)
- Frontend: Vite build served statically

**Legacy Systems:**
- CareVision SQL Server (192.168.4.8) — Patient records, appointments, consultations
- BDPharma SQL Server — Pharmacy data
- PICS images on network shares

**Data Scale:**
- 50,678 patients
- 29,392 appointments
- ~240,000 invoices
- 227 pharmacy inventory items with alerts

**Known Technical Debt:**
- 4 refraction components with ~400 lines duplicated
- 3 invoice builder implementations
- Billing tab disconnected from consultation flow
- No MongoDB replica set (transactions limited)

## Constraints

- **Tech Stack**: Node.js/Express backend, React frontend, MongoDB — already deployed
- **Language**: French for all user-facing content
- **Currency**: CDF (primary), USD, EUR supported
- **Medical Standards**: French conventions — Monoyer/Parinaud scales, ICD-10
- **Infrastructure**: Windows Server, no containerization currently
- **Timeline**: Production use needed ASAP — prioritize stability over new features

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CareVision migration approach | Import all legacy data rather than fresh start | ✓ Good — 50K patients preserved |
| StudioVision color-coded UI | Match clinical mental model (pink=refraction, green=IOP) | ✓ Good — intuitive for staff |
| MongoDB standalone | Simpler deployment, but limits transactions | ⚠️ Revisit — some features need replica set |
| Memory fallback for Redis | Redis not installed on server | ⚠️ Revisit — sessions may be lost on restart |

---
*Last updated: 2026-01-22 after initialization*
