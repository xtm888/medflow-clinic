# Technology Stack

**Analysis Date:** 2026-01-25

## Languages

**Primary:**
- **Node.js** v18+ - Backend runtime (`backend/server.js`), also used for central-server
- **JavaScript/ES6+** - All backend services and scripts (CommonJS module system)
- **React 19.1.1** - Frontend UI framework (`frontend/package.json`)
- **Python 3.9** - Microservices: Face recognition, OCR, DICOM Bridge

**Secondary:**
- **JSX** - React component syntax (`.jsx` files in `frontend/src/`)
- **CSS/Tailwind** - Styling via Tailwind CSS v3.4.1
- **PostCSS** - CSS processing

## Runtime

**Environment:**
- **Node.js**: v18.0.0+ (specified in `backend/package.json` engines)
- **npm**: v8.0.0+

**Package Manager:**
- **npm** for Node.js projects (backend, frontend, central-server)
- **pip** for Python microservices
- Lockfiles: `package-lock.json` present for reproducible builds

## Frameworks

**Core Backend:**
- **Express** v4.18.2 - REST API framework (`backend/server.js`)
- **Mongoose** v7.5.0 - MongoDB ODM with schema validation
- **Socket.io** v4.5.4 - Real-time WebSocket communication

**Core Frontend:**
- **React** v19.1.1 - UI framework with hooks
- **React Router** v6.26.2 - Client-side routing (`frontend/src/App.jsx`)
- **Vite** v4.5.3 - Build tool and dev server (`frontend/vite.config.js`)
- **Tailwind CSS** v3.4.1 - Utility-first CSS framework

**State Management:**
- **Redux Toolkit** v2.10.1 - Global state management (`frontend/src/store/`)
- **Redux Persist** v6.0.0 - Redux state persistence
- **React Query (TanStack)** v5.90.8 - Server state caching

**Testing:**
- **Jest** v29.6.4 - Backend unit/integration tests (`backend/jest.config.js`)
- **Vitest** v4.0.15 - Frontend unit tests
- **Playwright** v1.57.0 - E2E testing (`tests/playwright/`)
- **Supertest** v6.3.3 - HTTP assertion library for APIs
- **MongoDB Memory Server** v9.1.6 - In-memory MongoDB for testing

**Microservices:**
- **FastAPI** - DICOM Bridge Python service (`dicom-bridge/`)
- **Flask** - Face Recognition service (`face-service/app.py`)
- **FastAPI/Celery** - OCR service with async task queue (`ocr-service/`)

**Build/Dev:**
- **Nodemon** v3.0.1 - Auto-restart on file changes (development)
- **ESLint** v9.36.0 - Code linting
- **Prettier** v3.2.5 - Code formatting
- **Rollup** - Module bundler (via Vite)
- **Webpack/Workbox** v7.3.0 - Service worker bundling for PWA

## Key Dependencies

**Critical Backend:**
- **mongodb/mongoose** - Document database with ODM
- **redis** v4.6.8 - Session store, caching, rate limiting (falls back to memory if unavailable)
- **jsonwebtoken** v9.0.2 - JWT auth with access/refresh tokens
- **bcryptjs** v2.4.3 - Password hashing
- **helmet** v7.0.0 - Security headers
- **cors** v2.8.5 - CORS handling
- **express-rate-limit** v6.10.0 - API rate limiting (with Redis support)
- **express-validator** v7.0.1 - Request validation
- **multer** v1.4.5-lts.1 - File upload handling

**Data Processing:**
- **pdfkit** v0.17.2 - PDF generation (invoices, prescriptions, documents)
- **sharp** v0.34.5 - Image processing
- **csv-parser** v3.2.0 - CSV parsing
- **xml2js** v0.6.2 - XML parsing
- **pdf-parse** v1.1.1 - PDF parsing
- **dicom-parser** v1.8.21 - DICOM medical imaging files
- **tesseract.js** v5.0.5 - Client-side OCR fallback

**Network/Integration:**
- **axios** v1.6.0 - HTTP client (both backend & frontend)
- **@marsaud/smb2** v0.18.0 - SMB2 network file share protocol
- **mssql** v12.2.0 - SQL Server driver (legacy CareVision/Medicare integration)
- **better-sqlite3** v12.6.2 - SQLite for local data caching
- **bull** v4.12.2 - Task queue for background jobs

**Monitoring/Logging:**
- **winston** v3.11.0 - Structured logging
- **morgan** v1.10.0 - HTTP request logging
- **prom-client** v15.1.0 - Prometheus metrics
- **@sentry/react** v10.26.0 - Error tracking (frontend)

**Device Integration:**
- **chokidar** v3.6.0 - File system watcher for device folders
- **node-cron** v3.0.2 - Scheduled tasks
- **googleapis** v166.0.0 - Google Calendar integration

**Security/Encryption:**
- **speakeasy** v2.0.0 - Two-factor authentication (TOTP)
- **uuid** v13.0.0 - Unique ID generation
- Built-in `crypto` - PHI field-level encryption at rest

**Frontend UI:**
- **lucide-react** v0.553.0 - Icon library
- **react-toastify** v11.0.5 - Toast notifications
- **recharts** v3.3.0 - Charts/analytics visualization
- **dexie** v4.2.1 - IndexedDB wrapper (offline capability)
- **dompurify** v3.3.1 - HTML sanitization
- **date-fns** v4.1.0 - Date manipulation
- **yup** v1.7.1 - Form validation schema
- **@tanstack/react-virtual** v3.13.13 - Virtual list scrolling for large datasets

**PWA/Offline:**
- **workbox-webpack-plugin** v7.3.0 - Service worker generation
- **workbox-window** v7.3.0 - Service worker client
- **socket.io-client** v4.8.1 - WebSocket client

**API Documentation:**
- **swagger-jsdoc** v6.2.8 - OpenAPI spec generation
- **swagger-ui-express** v5.0.0 - Swagger UI endpoint

**Utilities:**
- **compression** v1.7.4 - GZIP compression middleware
- **cookie-parser** v1.4.7 - Cookie parsing
- **dotenv** v16.3.1 - Environment variable loading
- **joi** v17.12.0 - Data validation
- **fuse.js** v7.1.0 - Fuzzy search
- **qrcode** v1.5.3 - QR code generation
- **papaparse** v5.5.3 - CSV parsing (alternative)
- **isomorphic-fetch** v3.0.0 - Fetch polyfill
- **opossum** v8.1.3 - Circuit breaker pattern

**Python Libraries:**
- **pynetdicom** v2.0.2+ - DICOM network protocol (DICOM Bridge)
- **pydicom** v2.4.0+ - DICOM file handling
- **deepface** - Face recognition (face-service)
- **opencv-python** - Computer vision (face detection preprocessing)
- **pillow** - Image processing
- **flask** / **fastapi** - Web frameworks

## Configuration

**Environment:**
- **Development**: `backend/.env` (local development with MongoDB/Redis)
- **Production**: `backend/.env.production` (MongoDB Atlas, Upstash Redis, email via Mailtrap)
- **Multi-clinic instances**: `backend/.env.kinshasa`, `.env.goma`, `.env.lubumbashi` (geographic deployment)
- Central server: `central-server/.env` (multi-clinic coordination)
- Frontend: `frontend/.env`, `frontend/.env.production`

**Key Environment Variables:**
- `NODE_ENV`: production/development
- `MONGODB_URI`: Local or Atlas connection string
- `REDIS_URL`: Redis/Upstash connection
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`: Auth keys
- `PHI_ENCRYPTION_KEY`: Field-level encryption for sensitive medical data
- `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `CALENDAR_ENCRYPTION_KEY`, `LIS_ENCRYPTION_KEY`: Domain-specific encryption
- `FACE_SERVICE_URL`: Face recognition microservice endpoint (default: `http://127.0.0.1:5002`)
- `OCR_SERVICE_URL`: OCR microservice endpoint (default: `http://127.0.0.1:5003`)
- `CLINIC_*`: Clinic metadata (name, address, logo, etc.)
- `CAREVISION_SQL_*`: Legacy SQL Server integration
- `MEDICARE_SQL_*`: Legacy pharmacy SQL Server integration
- `PACS_*`: DICOM PACS server configuration
- `DICOM_BRIDGE_*`: DICOM Bridge microservice configuration

**Build Configuration:**
- **Frontend**: `frontend/vite.config.js` (path aliases, bundle splitting, console stripping in production)
- **Backend**: `backend/jest.config.js` (test configuration with MongoDB Memory Server)
- **Linting**: `.eslintrc` files in both backend and frontend
- **Formatting**: `.prettierrc` (shared code style)
- **Tailwind**: `frontend/tailwind.config.js` (custom design system)
- **PostCSS**: `frontend/postcss.config.js` (autoprefixer)

**Docker/Deployment:**
- **PM2**: `ecosystem.config.js` for production process management
- **Windows Server**: Batch scripts for server management (E:\MedFlow\matrix-backend\backend)

## Platform Requirements

**Development:**
- Node.js 18.0.0+
- npm 8.0.0+
- Python 3.9+ (for microservices)
- MongoDB (local or Atlas cloud)
- Redis (local or Upstash cloud)
- Git for version control

**Production:**
- **Deployment Target**: Windows Server (192.168.4.8, E:\MedFlow path)
- **Backend Port**: 5001
- **Frontend Port**: Vite dev: 5173 (development), built dist for production
- **MongoDB**: MongoDB Atlas cloud (Cluster0.nyylqsu.mongodb.net)
- **Redis**: Upstash cloud (glowing-horse-10937.upstash.io)
- **Microservices**: Python services on separate ports (5002, 5003, 11112)
- **Email**: Mailtrap Sending API (sandbox.api.mailtrap.io)
- **File Storage**: Local filesystem (SMB2 network shares supported)

**Browser Support:**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Progressive Web App (PWA) capability with offline support via Service Workers

---

*Stack analysis: 2026-01-25*
