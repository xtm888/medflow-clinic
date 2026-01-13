# Technology Stack

**Analysis Date:** 2026-01-13

## Languages

**Primary:**
- JavaScript (ES6+) - All application code (`backend/`, `frontend/src/`, `central-server/`)
- TypeScript support via JSDoc and tsconfig references

**Secondary:**
- Python 3.x - Microservices (`face-service/`, `ocr-service/`)

## Runtime

**Environment:**
- Node.js 18+ - `backend/package.json` engines field
- Python 3.x - Face recognition and OCR microservices
- npm 8.0.0+ - Package management

**Package Manager:**
- npm - Primary for all Node.js projects
- pip - Python dependencies via `requirements.txt`
- Lockfiles: `package-lock.json` present in all Node.js projects

## Frameworks

**Core:**
- Express.js 4.18.2 - Backend web framework (`backend/package.json`)
- React 19.1.1 - Frontend UI framework (`frontend/package.json`)
- Flask 3.0.0 - Face recognition microservice (`face-service/requirements.txt`)
- FastAPI 0.109.0 - OCR microservice (`ocr-service/requirements.txt`)

**Testing:**
- Jest 29.6.4 - Backend unit/integration tests (`backend/package.json`)
- Vitest 4.0.15 - Frontend unit tests (`frontend/package.json`)
- Playwright 1.57.0 - E2E browser tests (`package.json`)
- MongoDB Memory Server 9.1.6 - Backend test database (`backend/package.json`)

**Build/Dev:**
- Vite 4.5.3 - Frontend bundling and dev server (`frontend/package.json`)
- Workbox 7.3.0 - Service worker generation (`frontend/package.json`)
- Nodemon 3.0.2 - Backend development hot reload (`backend/package.json`)
- ESLint - Code linting (both backend and frontend)
- Prettier 3.2.5 - Code formatting (`backend/package.json`)

## Key Dependencies

**Backend Core:**
- mongoose 7.5.0 - MongoDB ODM (`backend/package.json`)
- helmet 7.0.0 - HTTP security headers (`backend/package.json`)
- cors 2.8.5 - Cross-origin request support (`backend/package.json`)
- compression 1.7.4 - Response compression (`backend/package.json`)
- morgan 1.10.0 - HTTP request logging (`backend/package.json`)
- dotenv 16.3.1 - Environment variable loading (`backend/package.json`)

**Authentication & Security:**
- jsonwebtoken 9.0.2 - JWT token handling (`backend/package.json`)
- bcryptjs 2.4.3 - Password hashing (`backend/package.json`)
- speakeasy 2.0.0 - 2FA/TOTP support (`backend/package.json`)
- express-validator 7.0.1 - Request validation (`backend/package.json`)
- Joi 17.12.0 - Schema validation (`backend/package.json`)
- express-rate-limit 6.10.0 - API rate limiting (`backend/package.json`)

**Frontend State & Data:**
- @reduxjs/toolkit 2.10.1 - State management (`frontend/package.json`)
- @tanstack/react-query 5.90.8 - Server state caching (`frontend/package.json`)
- redux-persist 6.0.0 - Offline persistence (`frontend/package.json`)
- dexie 4.2.1 - IndexedDB wrapper for offline support (`frontend/package.json`)
- react-router-dom 6.26.2 - Client-side routing (`frontend/package.json`)

**Real-time Communication:**
- socket.io 4.5.4 - WebSocket server (`backend/package.json`)
- socket.io-client 4.8.1 - WebSocket client (`frontend/package.json`)
- axios 1.6.0 - HTTP client (both backend and frontend)

**Document & Image Processing:**
- pdfkit 0.17.2 - PDF generation (`backend/package.json`)
- sharp 0.34.5 - Image processing (`backend/package.json`)
- xml2js 0.6.2 - XML parsing (`backend/package.json`)
- csv-parser 3.2.0 - CSV parsing (`backend/package.json`)
- QRCode 1.5.3 - QR code generation (`backend/package.json`)

**UI Components & Styling:**
- tailwindcss 3.4.1 - Utility-first CSS framework (`frontend/package.json`)
- lucide-react 0.553.0 - Icon library (`frontend/package.json`)
- react-toastify 11.0.5 - Toast notifications (`frontend/package.json`)
- recharts 3.3.0 - Data visualization charts (`frontend/package.json`)
- yup 1.7.1 - Form validation (`frontend/package.json`)

**Monitoring & Error Tracking:**
- @sentry/react 10.26.0 - Frontend error tracking (`frontend/package.json`)
- winston 3.11.0 - Structured logging (`backend/package.json`)
- prom-client 15.1.0 - Prometheus metrics (`backend/package.json`)

**Device Integration:**
- @marsaud/smb2 0.18.0 - SMB2 network share access (`backend/package.json`)
- chokidar 3.6.0 - File system monitoring (`backend/package.json`)

**Python Microservices:**
- face_recognition 1.3.0 - DeepFace integration (`face-service/requirements.txt`)
- paddleocr 2.7.3 - OCR engine (`ocr-service/requirements.txt`)
- celery 5.3.6 - Async task queue (`ocr-service/requirements.txt`)
- pydicom 2.4.4 - DICOM image handling (`ocr-service/requirements.txt`)
- pydantic 2.5.3 - Data validation (`ocr-service/requirements.txt`)

## Configuration

**Environment:**
- `.env` files per environment - `backend/.env.example`, `backend/.env.clinic.template`
- Key variables: `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `PHI_ENCRYPTION_KEY`
- Clinic-specific: `CLINIC_ID`, `CLINIC_NAME`, `BASE_CURRENCY`
- External services: `FACE_SERVICE_URL`, `OCR_SERVICE_URL`

**Build:**
- `vite.config.js` - Frontend build configuration
- `tailwind.config.js` - Tailwind CSS customization
- `tsconfig.json` - TypeScript/JSDoc configuration
- `jest.config.js` - Backend test configuration
- `vitest.config.js` - Frontend test configuration
- `playwright.config.ts` - E2E test configuration

## Platform Requirements

**Development:**
- Any platform with Node.js 18+ and npm 8+
- Docker (optional) for MongoDB/Redis via `docker-compose.yml`
- Python 3.x for microservices development

**Production:**
- Docker containers - Multi-service orchestration via `docker-compose.yml`
- MongoDB 6.0 - Primary database
- Redis 7-alpine - Cache, sessions, rate limiting
- Vercel (frontend) or custom Docker deployment

---

*Stack analysis: 2026-01-13*
*Update after major dependency changes*
