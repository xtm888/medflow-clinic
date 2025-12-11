/**
 * MSW Request Handlers
 *
 * Mock API handlers for testing. These intercept network requests
 * and return controlled responses for reliable testing.
 */

import { http, HttpResponse } from 'msw';

// Base URL for API requests
const API_BASE = 'http://localhost:5001/api';

// Mock data factories
export const mockPatient = (overrides = {}) => ({
  _id: 'patient_123',
  id: 'patient_123',
  patientId: 'PAT-001',
  firstName: 'Jean',
  lastName: 'Dupont',
  nationalId: 'FR123456789',
  dateOfBirth: '1985-03-15',
  gender: 'male',
  phoneNumber: '+33612345678',
  email: 'jean.dupont@email.com',
  address: '123 Rue de Paris',
  allergies: ['Pénicilline'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const mockInvoice = (overrides = {}) => ({
  _id: 'invoice_123',
  id: 'invoice_123',
  invoiceNumber: 'INV-2024-001',
  patientId: 'patient_123',
  visitId: 'visit_123',
  status: 'pending',
  items: [
    { description: 'Consultation', quantity: 1, unitPrice: 5000, total: 5000 }
  ],
  subtotal: 5000,
  tax: 0,
  totalAmount: 5000,
  amountPaid: 0,
  amountDue: 5000,
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockLabOrder = (overrides = {}) => ({
  _id: 'laborder_123',
  id: 'laborder_123',
  patientId: 'patient_123',
  visitId: 'visit_123',
  status: 'pending',
  priority: 'routine',
  tests: [
    { code: 'CBC', name: 'Complete Blood Count' }
  ],
  orderedBy: 'doctor_123',
  orderedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockOphthalmologyExam = (overrides = {}) => ({
  _id: 'exam_123',
  id: 'exam_123',
  patientId: 'patient_123',
  visitId: 'visit_123',
  examType: 'comprehensive',
  status: 'completed',
  visualAcuity: {
    rightEye: { uncorrected: '20/40', corrected: '20/20' },
    leftEye: { uncorrected: '20/30', corrected: '20/20' }
  },
  refraction: {
    rightEye: { sphere: -2.00, cylinder: -0.50, axis: 180 },
    leftEye: { sphere: -1.75, cylinder: -0.25, axis: 175 }
  },
  intraocularPressure: {
    rightEye: 14,
    leftEye: 15
  },
  examinerId: 'doctor_123',
  createdAt: new Date().toISOString(),
  ...overrides
});

// ============== CONVENTION BILLING MOCKS ==============

export const mockCompany = (overrides = {}) => ({
  _id: 'company_123',
  id: 'company_123',
  name: 'CIGNA 80%',
  conventionType: 'insurance',
  defaultCoverage: 80,
  isActive: true,
  categoryRules: {
    consultation: { coverage: 80 },
    surgery: { coverage: 80 },
    laboratory: { coverage: 80 },
    pharmacy: { coverage: 80 },
    optical: { coverage: 80 }
  },
  autoApproveThreshold: 100,
  currency: 'CDF',
  contactEmail: 'claims@cigna.com',
  contactPhone: '+243 999 000 000',
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockFeeSchedule = (overrides = {}) => ({
  _id: 'fee_123',
  id: 'fee_123',
  code: 'CONSULT-001',
  description: 'Consultation Ophtalmologique',
  category: 'consultation',
  unitPrice: 15000,
  currency: 'CDF',
  isActive: true,
  clinicId: 'clinic_gombe',
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockApproval = (overrides = {}) => ({
  _id: 'approval_123',
  id: 'approval_123',
  patientId: 'patient_123',
  companyId: 'company_456',
  invoiceId: 'invoice_123',
  requestedItems: [
    { code: 'PHACO', description: 'Cataract Surgery', amount: 150000, category: 'surgery' }
  ],
  totalAmount: 150000,
  status: 'pending',
  requestedBy: 'doctor_123',
  requestedAt: new Date().toISOString(),
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockSurgeryCase = (overrides = {}) => ({
  _id: 'surgery_123',
  id: 'surgery_123',
  patientId: 'patient_123',
  visitId: 'visit_123',
  invoiceId: 'invoice_123',
  procedureCode: 'PHACO',
  procedureName: 'Cataract Surgery - Phacoemulsification',
  eye: 'right',
  status: 'awaiting_scheduling',
  priority: 'routine',
  surgeon: 'doctor_123',
  scheduledDate: null,
  operatingRoom: null,
  notes: '',
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockGlassesOrder = (overrides = {}) => ({
  _id: 'glasses_123',
  id: 'glasses_123',
  patientId: 'patient_123',
  prescriptionId: 'prescription_123',
  orderNumber: 'GO-2024-001',
  status: 'production',
  frame: {
    brand: 'Ray-Ban',
    model: 'RB5154',
    color: 'Black',
    size: '49-21-140'
  },
  lenses: {
    type: 'progressive',
    material: 'polycarbonate',
    coatings: ['anti-reflective', 'scratch-resistant']
  },
  rightLens: { sphere: -2.00, cylinder: -0.50, axis: 180, add: 2.00 },
  leftLens: { sphere: -1.75, cylinder: -0.25, axis: 175, add: 2.00 },
  orderDate: new Date().toISOString(),
  estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockInventoryTransfer = (overrides = {}) => ({
  _id: 'transfer_123',
  id: 'transfer_123',
  transferNumber: 'TRF-2024-001',
  transferType: 'depot-to-clinic',
  sourceClinic: 'depot_central',
  destinationClinic: 'clinic_gombe',
  status: 'pending',
  items: [
    { itemId: 'pharm_123', name: 'Timolol 0.5%', quantity: 50, unit: 'bottles' }
  ],
  requestedBy: 'user_123',
  requestedAt: new Date().toISOString(),
  approvedBy: null,
  shippedAt: null,
  receivedAt: null,
  notes: '',
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockPharmacyItem = (overrides = {}) => ({
  _id: 'pharm_123',
  id: 'pharm_123',
  name: 'Timolol 0.5%',
  genericName: 'Timolol Maleate',
  category: 'eye_drops',
  form: 'solution',
  strength: '0.5%',
  unit: 'bottle',
  currentStock: 45,
  reorderLevel: 20,
  maxStock: 100,
  isLowStock: false,
  isCriticalStock: false,
  expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  batchNumber: 'BATCH-2024-001',
  supplier: 'PharmaCongo',
  unitPrice: 5000,
  currency: 'CDF',
  clinicId: 'clinic_gombe',
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockVisit = (overrides = {}) => ({
  _id: 'visit_123',
  id: 'visit_123',
  patientId: 'patient_123',
  visitNumber: 'VST-2024-001',
  visitType: 'consultation',
  status: 'in_progress',
  chiefComplaint: 'Vision floue',
  clinicId: 'clinic_gombe',
  providerId: 'doctor_123',
  checkedInAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: null,
  createdAt: new Date().toISOString(),
  ...overrides
});

export const mockQueueEntry = (overrides = {}) => ({
  _id: 'queue_123',
  id: 'queue_123',
  patientId: 'patient_123',
  visitId: 'visit_123',
  position: 1,
  status: 'waiting',
  priority: 'normal',
  department: 'ophthalmology',
  checkedInAt: new Date().toISOString(),
  estimatedWait: 15,
  clinicId: 'clinic_gombe',
  createdAt: new Date().toISOString(),
  ...overrides
});

// API Handlers
export const handlers = [
  // ================== PATIENTS ==================
  http.get(`${API_BASE}/patients`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockPatient(), mockPatient({ _id: 'patient_456', patientId: 'PAT-002' })],
      total: 2,
      page: 1,
      pages: 1
    });
  }),

  http.get(`${API_BASE}/patients/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockPatient({ _id: params.id, id: params.id })
    });
  }),

  http.post(`${API_BASE}/patients`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockPatient({ ...body, _id: 'new_patient_id' })
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/patients/:id`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockPatient({ ...body, _id: params.id })
    });
  }),

  // ================== INVOICES ==================
  http.get(`${API_BASE}/invoices`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockInvoice()],
      total: 1
    });
  }),

  http.get(`${API_BASE}/invoices/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockInvoice({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/invoices`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockInvoice(body)
    }, { status: 201 });
  }),

  http.post(`${API_BASE}/invoices/:id/payments`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        _id: 'payment_123',
        invoiceId: params.id,
        amount: body.amount,
        method: body.method,
        paymentDate: new Date().toISOString()
      }
    }, { status: 201 });
  }),

  // ================== LAB ORDERS ==================
  http.get(`${API_BASE}/lab-orders`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockLabOrder()]
    });
  }),

  http.get(`${API_BASE}/lab-orders/pending`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockLabOrder({ status: 'pending' })]
    });
  }),

  http.get(`${API_BASE}/lab-orders/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockLabOrder({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/lab-orders`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockLabOrder(body)
    }, { status: 201 });
  }),

  // ================== OPHTHALMOLOGY ==================
  http.get(`${API_BASE}/ophthalmology/exams`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockOphthalmologyExam()]
    });
  }),

  http.get(`${API_BASE}/ophthalmology/exams/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockOphthalmologyExam({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/ophthalmology/exams`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockOphthalmologyExam(body)
    }, { status: 201 });
  }),

  // ================== SYNC ==================
  http.post(`${API_BASE}/sync/pull`, () => {
    return HttpResponse.json({
      success: true,
      changes: {
        patients: [],
        appointments: [],
        prescriptions: []
      },
      timestamp: new Date().toISOString()
    });
  }),

  // ================== AUTH ==================
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (body.email === 'test@test.com' && body.password === 'password') {
      return HttpResponse.json({
        success: true,
        user: {
          _id: 'user_123',
          email: 'test@test.com',
          role: 'doctor'
        },
        token: 'mock_jwt_token'
      });
    }
    return HttpResponse.json({
      success: false,
      error: 'Invalid credentials'
    }, { status: 401 });
  }),

  // ================== HEALTH ==================
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }),

  // ================== COMPANIES/CONVENTIONS ==================
  http.get(`${API_BASE}/companies`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockCompany(),
        mockCompany({
          _id: 'company_456',
          name: 'ACTIVA',
          conventionType: 'insurance',
          defaultCoverage: 100,
          categoryRules: {
            surgery: { requiresApproval: true },
            optical: { requiresApproval: true },
            laboratory: { coverage: 100 },
            pharmacy: { coverage: 80 }
          }
        }),
        mockCompany({
          _id: 'company_789',
          name: 'AAC',
          conventionType: 'corporate',
          defaultCoverage: 100,
          categoryRules: {
            optical: { coverage: 100 },
            surgery: { notCovered: true },
            laboratory: { notCovered: true }
          }
        })
      ]
    });
  }),

  http.get(`${API_BASE}/companies/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockCompany({ _id: params.id })
    });
  }),

  // ================== FEE SCHEDULES ==================
  http.get(`${API_BASE}/fee-schedules`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockFeeSchedule(),
        mockFeeSchedule({
          _id: 'fee_456',
          code: 'PHACO',
          description: 'Cataract Surgery PHACO',
          category: 'surgery',
          unitPrice: 150000,
          currency: 'CDF'
        }),
        mockFeeSchedule({
          _id: 'fee_789',
          code: 'LAB-HBA1C',
          description: 'HbA1c Test',
          category: 'laboratory',
          unitPrice: 25000,
          currency: 'CDF'
        })
      ]
    });
  }),

  http.get(`${API_BASE}/fee-schedules/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockFeeSchedule({ _id: params.id })
    });
  }),

  // ================== APPROVALS ==================
  http.get(`${API_BASE}/approvals`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockApproval()]
    });
  }),

  http.get(`${API_BASE}/approvals/pending`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockApproval({ status: 'pending' })]
    });
  }),

  http.get(`${API_BASE}/approvals/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockApproval({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/approvals`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockApproval({ ...body, _id: 'approval_new', status: 'pending' })
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/approvals/:id/approve`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockApproval({ _id: params.id, status: 'approved' })
    });
  }),

  http.put(`${API_BASE}/approvals/:id/reject`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockApproval({ _id: params.id, status: 'rejected' })
    });
  }),

  // ================== SURGERY CASES ==================
  http.get(`${API_BASE}/surgery-cases`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockSurgeryCase()]
    });
  }),

  http.get(`${API_BASE}/surgery-cases/awaiting`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockSurgeryCase({ status: 'awaiting_scheduling' })]
    });
  }),

  http.get(`${API_BASE}/surgery-cases/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockSurgeryCase({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/surgery-cases`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockSurgeryCase(body)
    }, { status: 201 });
  }),

  // ================== GLASSES ORDERS ==================
  http.get(`${API_BASE}/glasses-orders`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockGlassesOrder()]
    });
  }),

  http.get(`${API_BASE}/glasses-orders/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockGlassesOrder({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/glasses-orders`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockGlassesOrder(body)
    }, { status: 201 });
  }),

  // ================== CROSS-CLINIC INVENTORY ==================
  http.get(`${API_BASE}/cross-clinic-inventory/summary`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        totalClinics: 4,
        inventoryTypes: ['pharmacy', 'frames', 'contactLenses', 'reagents', 'opticalLenses', 'labConsumables'],
        summary: {
          pharmacy: { totalItems: 150, lowStock: 5, criticalStock: 2 },
          frames: { totalItems: 200, lowStock: 10, criticalStock: 3 }
        }
      }
    });
  }),

  http.get(`${API_BASE}/cross-clinic-inventory/alerts`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        { type: 'critical', clinic: 'Gombe', item: 'Timolol 0.5%', currentStock: 2, reorderLevel: 10 },
        { type: 'warning', clinic: 'Ngaliema', item: 'Latanoprost', currentStock: 8, reorderLevel: 15 }
      ]
    });
  }),

  // ================== INVENTORY TRANSFERS ==================
  http.get(`${API_BASE}/inventory-transfers`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockInventoryTransfer()]
    });
  }),

  http.get(`${API_BASE}/inventory-transfers/stats`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        total: 45,
        pending: 5,
        inTransit: 8,
        completed: 30,
        cancelled: 2
      }
    });
  }),

  http.post(`${API_BASE}/inventory-transfers`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockInventoryTransfer(body)
    }, { status: 201 });
  }),

  // ================== PHARMACY INVENTORY ==================
  http.get(`${API_BASE}/pharmacy/inventory`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockPharmacyItem(),
        mockPharmacyItem({
          _id: 'pharm_456',
          name: 'Latanoprost 0.005%',
          category: 'eye_drops',
          currentStock: 5,
          reorderLevel: 10,
          isLowStock: true
        })
      ]
    });
  }),

  http.get(`${API_BASE}/pharmacy/inventory/low-stock`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockPharmacyItem({ currentStock: 3, reorderLevel: 10, isLowStock: true })
      ]
    });
  }),

  http.post(`${API_BASE}/pharmacy/dispense`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        dispensedAt: new Date().toISOString(),
        items: body.items,
        patient: body.patientId
      }
    });
  }),

  // ================== VISITS ==================
  http.get(`${API_BASE}/visits`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockVisit()]
    });
  }),

  http.get(`${API_BASE}/visits/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockVisit({ _id: params.id })
    });
  }),

  http.post(`${API_BASE}/visits`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockVisit(body)
    }, { status: 201 });
  }),

  // ================== QUEUE ==================
  http.get(`${API_BASE}/queue`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockQueueEntry(),
        mockQueueEntry({ _id: 'queue_456', position: 2, status: 'waiting' })
      ]
    });
  }),

  http.post(`${API_BASE}/queue/check-in`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockQueueEntry({ patientId: body.patientId, status: 'checked_in' })
    });
  })
];

// Error handlers for testing error scenarios
export const errorHandlers = [
  http.get(`${API_BASE}/patients`, () => {
    return HttpResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get(`${API_BASE}/invoices`, () => {
    return HttpResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  })
];

// Network error handlers
export const networkErrorHandlers = [
  http.get(`${API_BASE}/patients`, () => {
    return HttpResponse.error();
  })
];
