# 🏥 MedFlow - Medical Management System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?logo=tailwind-css)

A comprehensive, modern medical clinic management system built with React + Vite. Features staff portal, patient portal, and public booking system. Localized for Congo (Kinshasa) with USD currency, Congolese phone numbers (+243), and local addresses.

**Developed by Aymane Moumni**

🔗 **Live Demo:** [https://github.com/xtm888/medflow-clinic](https://github.com/xtm888/medflow-clinic)

---

## 🌟 Features Overview

### 🏢 Staff/Admin Portal (12 Pages)

#### 1. **Dashboard** 📊
- Real-time statistics (patients today, queue length, revenue, prescriptions)
- Revenue trend charts (line, bar, and pie charts)
- Current queue status visualization
- System alerts and notifications
- Quick action buttons linked to main features

#### 2. **Patient Management** 👥
- Complete patient list with search and advanced filters
- Patient details modal with full medical history
- Priority tagging (VIP, Pregnant, Elderly, Normal)
- Allergy tracking with visual alerts
- New patient registration form
- Congolese patient names and phone numbers

#### 3. **Queue Management** ⏱️
- Live queue dashboard with color-coded wait times
- Priority scoring algorithm (VIP, Pregnant, Urgent get priority)
- Visual alerts for patients waiting >30 minutes (pulsing red animation)
- Real-time wait time estimation
- Room assignment and status indicators
- Patient check-in/check-out flow

#### 4. **Appointments** 📅
- Calendar view with week/day/list views
- Appointment booking modal
- Service and doctor selection
- Status management (Confirmed, Pending, Cancelled, Completed)
- Room assignment
- Reminder system

#### 5. **Pharmacy & Stock Management** 💊
- Real-time stock level monitoring
- Out-of-stock medications grayed out
- Low stock warnings (orange badges)
- Batch tracking with expiration dates
- FEFO (First-Expiry-First-Out) algorithm with visual indicators
- Medications expiring <60 days highlighted
- Stock-aware prescription creation

#### 6. **Prescriptions** 📋
- New prescription creation interface
- Stock-aware medication selection
- Low stock visual indicators
- Out-of-stock medications disabled automatically
- Patient and doctor assignment
- Prescription status tracking

#### 7. **Medical Imaging** 🔬
- DICOM study listing
- Modality badges (X-RAY, MRI, CT, ULTRASOUND)
- Study details and metadata
- Image count tracking
- Radiologist assignment

#### 8. **Services & Pricing** 💼
- Medical services catalog
- Category management (Consultation, Imagerie, Laboratoire, Procédure, Urgence)
- Price management in USD ($)
- Duration tracking
- Department assignment
- Service codes

#### 9. **Notifications** 📱
- Multi-channel support (SMS, WhatsApp, Email)
- Delivery status tracking (Delivered, Read, Sent, Failed)
- Cost tracking per notification (Twilio integration ready)
- Success rate dashboard
- Patient communication history

#### 10. **Financial Dashboard** 💰
- Today/Month/Year revenue tracking
- Revenue trends (line + bar + pie charts)
- Service breakdown with detailed tables
- Outstanding receivables tracking
- Payment analysis

#### 11. **Invoicing** 🧾
- Complete invoice management
- Patient and B2B (company) billing
- Invoice creation with service selection
- Payment tracking (Paid, Partial, Pending, Overdue, Cancelled)
- Payment history
- PDF export (ready for implementation)
- Email sending functionality
- Congo clinic information on invoices

#### 12. **Settings** ⚙️
- User profile management
- Clinic information configuration
- Notification preferences
- Twilio configuration (SMS/WhatsApp)
- System configuration

---

### 👤 Patient Portal (7 Pages + Login)

#### 1. **Patient Login** 🔐
- Secure authentication interface
- Password visibility toggle
- Remember me functionality
- Forgot password link
- New patient registration link
- Emergency contact information

#### 2. **Patient Dashboard** 🏠
- Personalized welcome message
- Quick stats (appointments, prescriptions, results, balance)
- Upcoming appointments preview
- Recent prescriptions
- Quick actions (Take appointment, Contact doctor, Pay bills)
- Important alerts and notices

#### 3. **Appointments** 📆
- View upcoming and past appointments
- Appointment details
- Status indicators
- Cancel/reschedule options (ready for implementation)

#### 4. **Prescriptions** 💊
- Active prescriptions list
- Prescription history
- Medication details
- Pickup status
- Download/print functionality (ready)

#### 5. **Bills & Payments** 💳
- Outstanding balance overview
- Invoice list with payment status
- Payment history
- Payment method selection (ready for implementation)
- Download invoices

#### 6. **Medical Results** 📄
- Lab results
- Imaging study results
- Result status tracking
- Download/view functionality (ready)

#### 7. **Messages** 💬
- Secure messaging with medical team
- Message history (ready for implementation)
- Emergency contact information

#### 8. **Profile** 👤
- Personal information management
- Contact details
- Medical history
- Allergy information
- Emergency contacts

---

### 🌐 Public Booking System

#### **Public Booking Page** 📝
- No login required
- Simple booking form (Name, Phone, Email, Service, Preferred Date/Time)
- Congo phone number validation (+243 XX XXX XXXX)
- Operator validation (Vodacom, Airtel, Orange, Africell)
- Rate limiting (1 booking per 5 minutes per phone number)
- WhatsApp & Email confirmation
- User-friendly confirmation page

---

## 🇨🇩 Congo Localization

### Phone Numbers
- Format: `+243 XX XXX XXXX`
- Supported operators:
  - Vodacom (81, 82)
  - Airtel (97, 98, 99)
  - Orange (84, 85, 89)
  - Africell (90, 91)
- Full validation in public booking system

### Addresses
- Kinshasa neighborhoods: Gombe, Ngaliema, Limete
- Congolese street names and formats
- Example: "Avenue du Commerce, n°45, Gombe, Kinshasa"

### Currency
- USD ($) throughout the entire system
- All prices, invoices, and financial data in dollars

### Patient Names
- Congolese names: Mbuyi Kabongo, Tshala Mwamba, Nkulu Tshisekedi
- Authentic local representation

### Emergency Numbers
- Emergency: 112
- Police: 113
- Clinic: +243 81 234 5678

---

## 🛠 Tech Stack

- **Frontend Framework:** React 18
- **Build Tool:** Vite 4.5.3
- **Styling:** Tailwind CSS 3.4.1
- **Routing:** React Router 6.26.2
- **Charts:** Recharts
- **Icons:** Lucide React
- **Date Handling:** date-fns (with French locale)
- **HTTP Client:** Ready for Axios/Fetch integration

---

## 📦 Installation

### Prerequisites
- Node.js 18.17.1+ (compatible with current versions)
- npm or yarn

### Setup

```bash
# Clone repository
git clone https://github.com/xtm888/medflow-clinic.git
cd medflow-clinic

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit **http://localhost:5173**

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── config/
│   └── clinic.js              # Congo clinic configuration
├── data/
│   └── mockData.js            # Mock data for all features
├── layouts/
│   ├── MainLayout.jsx         # Staff/Admin layout with sidebar
│   └── PatientLayout.jsx      # Patient portal layout
├── pages/
│   ├── Dashboard.jsx          # Staff dashboard
│   ├── Patients.jsx           # Patient management
│   ├── Queue.jsx              # Queue management
│   ├── Appointments.jsx       # Appointment calendar
│   ├── Pharmacy.jsx           # Pharmacy & stock
│   ├── Prescriptions.jsx      # Prescription management
│   ├── Imaging.jsx            # Medical imaging
│   ├── Services.jsx           # Services & pricing
│   ├── Notifications.jsx      # Multi-channel notifications
│   ├── Financial.jsx          # Financial dashboard
│   ├── Invoicing.jsx          # Invoice management
│   ├── Settings.jsx           # System settings
│   ├── PublicBooking.jsx      # Public booking form
│   ├── BookingConfirmation.jsx
│   └── patient/               # Patient portal pages
│       ├── PatientLogin.jsx
│       ├── PatientDashboard.jsx
│       ├── PatientAppointments.jsx
│       ├── PatientPrescriptions.jsx
│       ├── PatientBills.jsx
│       ├── PatientResults.jsx
│       ├── PatientMessages.jsx
│       └── PatientProfile.jsx
├── App.jsx                    # Main routing
├── main.jsx                   # Entry point
└── index.css                  # Global styles
```

---

## 🚀 Key Features in Detail

### Priority Queue Algorithm
```javascript
priorityScore = basePriority + urgencyBonus + waitTimeBonus

basePriority:
- VIP: 5.0
- PREGNANT: 4.0
- ELDERLY: 3.0
- NORMAL: 2.0

urgencyBonus: 0-2 points based on symptoms
waitTimeBonus: +0.5 per 15 minutes waiting
```

### FEFO (First-Expiry-First-Out) Algorithm
```javascript
- Batches sorted by expiration date
- Visual indicators:
  - <30 days: Red badge (Critical)
  - <60 days: Orange badge (Warning)
  - >60 days: Green badge (Good)
- Automatic stock depletion from earliest expiring batch
```

### Rate Limiting (Public Booking)
```javascript
- 1 booking per 5 minutes per phone number
- localStorage-based (demo)
- Ready for Redis/backend implementation
- Clear error messages
```

---

## 🔐 Security Features

- Input validation on all forms
- Phone number format validation
- Email validation
- XSS protection (React default)
- Rate limiting on public endpoints
- Secure authentication flow (ready for JWT)

---

## 🎨 UI/UX Highlights

- **Responsive Design:** Mobile, tablet, and desktop optimized
- **Modern UI:** Clean, professional medical interface
- **Color-Coded Status:** Intuitive visual feedback
- **Loading States:** Smooth user experience
- **Error Handling:** User-friendly error messages
- **Accessibility:** ARIA labels and semantic HTML
- **French Language:** All UI text in French for Congo market

---

## 🔄 API Integration (Ready)

The system is designed for easy backend integration:

```javascript
// Example: Replace mock data with API calls
import { patients } from '../data/mockData'; // Current
↓
const response = await axios.get('/api/patients'); // Future
const patients = response.data;
```

All data structures are production-ready and match common medical API formats.

---

## 📊 Sample Data

The system includes comprehensive mock data:
- 3 patients (Congolese names)
- 50+ medications with batch tracking
- 10+ appointments
- 8 prescriptions
- 3 imaging studies
- 15+ services
- 4+ invoices with payment history
- Notifications across all channels

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👨‍💻 Author

**Aymane Moumni**

🤖 Built with [Claude Code](https://claude.com/claude-code)

---

## 🙏 Acknowledgments

- Inspired by OpenEMR
- Icons by Lucide
- Charts by Recharts
- UI components with Tailwind CSS

---

## 📞 Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Contact: [GitHub @xtm888](https://github.com/xtm888)

---

## 🗺️ Roadmap

- [ ] Backend API integration (Node.js/Express or Python/FastAPI)
- [ ] Real-time updates with WebSockets
- [ ] PDF generation for invoices and prescriptions
- [ ] Email/SMS integration with Twilio
- [ ] DICOM viewer integration
- [ ] Multi-clinic support
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] Data analytics and reporting
- [ ] Mobile app (React Native)

---

**⭐ If you find this project helpful, please star it on GitHub!**
