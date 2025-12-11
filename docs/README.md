# MedFlow - Medical Management System

**Version:** 1.0.0
**Status:** Development
**Last Updated:** December 2025

## Overview

MedFlow is a comprehensive, enterprise-grade medical management system designed specifically for ophthalmology clinics in the Democratic Republic of Congo. It provides end-to-end clinical workflow management from patient registration to billing, with specialized support for ophthalmology examinations, prescriptions, and medical device integration.

## Key Features

### Clinical Workflow
- Patient registration with face recognition
- Queue management with priority sorting
- Multi-step consultation workflows
- Ophthalmology examinations (12 configurable steps)
- Electronic prescriptions
- Laboratory order management
- Surgical case management (IVT injections)

### Medical Device Integration
- NIDEK equipment support
- Zeiss imaging devices
- Topcon systems
- OCT, Autorefractor, Tonometer, Biometer
- Specular Microscope, Visual Field analyzers
- SMB2 network share access for device data

### Financial Management
- Multi-currency support (USD, CDF)
- Insurance/convention billing
- Payment plans
- Invoice generation and tracking
- Financial reporting

### Multi-Clinic Operations
- Centralized patient records
- Cross-clinic inventory management
- Clinic-specific configurations
- Data synchronization

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 7+
- Redis 4+ (optional, for caching/sessions)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd magloire

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

### Default URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001
- API Documentation: http://localhost:5001/api-docs

## Project Structure

```
magloire/
├── backend/           # Express.js API server (192K LOC)
│   ├── controllers/   # Request handlers (59 files)
│   ├── models/        # MongoDB schemas (84 files)
│   ├── routes/        # API endpoints (78 files)
│   ├── services/      # Business logic (63+ files)
│   ├── middleware/    # Express middleware
│   └── scripts/       # Seed data and utilities
├── frontend/          # React SPA (160K LOC)
│   ├── src/
│   │   ├── pages/     # Route components
│   │   ├── components/# Reusable UI components
│   │   ├── services/  # API integration
│   │   ├── hooks/     # Custom React hooks
│   │   └── store/     # Redux state management
├── central-server/    # Multi-clinic sync server
├── face-service/      # Face recognition microservice
├── ocr-service/       # OCR processing service
└── docs/              # Documentation
```

## Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [Development Guide](./DEVELOPMENT.md)
- [API Reference](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Redux Toolkit, Tailwind CSS, Vite |
| Backend | Node.js, Express.js, MongoDB, Redis |
| Real-time | Socket.io |
| Authentication | JWT, 2FA (TOTP) |
| File Storage | Local filesystem, SMB2 shares |
| Documentation | Swagger/OpenAPI |

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please open a GitHub issue.
