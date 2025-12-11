const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Swagger/OpenAPI 3.0 Configuration
 *
 * Generates interactive API documentation from JSDoc comments
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MedFlow EMR API',
      version: '1.0.0',
      description: `
# MedFlow Electronic Medical Records System API

Comprehensive Hospital Management System API for ophthalmology clinics and general medical practice.

## Features

- Patient Management
- Appointment Scheduling
- Queue Management
- Prescriptions & Pharmacy
- Invoicing & Billing
- Ophthalmology Examinations
- Laboratory Orders & Results
- Medical Device Integration
- Face Recognition
- Multi-clinic Support
- Offline-first Architecture

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- General API calls: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Sensitive operations: 20 requests per 15 minutes

## Response Format

All responses follow a standardized format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "timestamp": "2025-12-07T10:00:00.000Z"
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "details": { ... },
  "timestamp": "2025-12-07T10:00:00.000Z"
}
\`\`\`
      `,
      contact: {
        name: 'MedFlow Support',
        email: 'support@medflow.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Development server'
      },
      {
        url: 'https://api.medflow.cd',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from the login endpoint'
        }
      },
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
            statusCode: { type: 'integer', example: 400 },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                pages: { type: 'integer' }
              }
            }
          }
        },

        // Patient schemas
        Patient: {
          type: 'object',
          required: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            patientId: { type: 'string', example: 'P000001' },
            firstName: { type: 'string', example: 'Jean' },
            lastName: { type: 'string', example: 'Kabongo' },
            dateOfBirth: { type: 'string', format: 'date', example: '1985-05-15' },
            gender: { type: 'string', enum: ['M', 'F', 'Other'], example: 'M' },
            phoneNumber: { type: 'string', example: '+243900000000' },
            email: { type: 'string', format: 'email', example: 'patient@example.com' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string', example: 'Kinshasa' },
                province: { type: 'string', example: 'Kinshasa' },
                country: { type: 'string', example: 'DRC' }
              }
            },
            convention: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                membershipNumber: { type: 'string' },
                coveragePercentage: { type: 'number', example: 80 },
                isActive: { type: 'boolean' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },

        // Appointment schemas
        Appointment: {
          type: 'object',
          required: ['patient', 'provider', 'appointmentDate', 'type'],
          properties: {
            _id: { type: 'string' },
            patient: { type: 'string', description: 'Patient ID' },
            provider: { type: 'string', description: 'Provider ID' },
            appointmentDate: { type: 'string', format: 'date-time' },
            duration: { type: 'integer', example: 30, description: 'Duration in minutes' },
            type: { type: 'string', enum: ['consultation', 'follow-up', 'surgery', 'emergency'] },
            status: { type: 'string', enum: ['scheduled', 'confirmed', 'completed', 'cancelled'] },
            reason: { type: 'string', example: 'Routine checkup' },
            notes: { type: 'string' }
          }
        },

        // Prescription schemas
        Prescription: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            patient: { type: 'string' },
            prescriber: { type: 'string' },
            type: { type: 'string', enum: ['medication', 'optical', 'therapy'] },
            status: { type: 'string', enum: ['active', 'dispensed', 'cancelled', 'expired'] },
            medications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Paracetamol' },
                  dosage: { type: 'string', example: '500mg' },
                  frequency: { type: 'string', example: 'TID' },
                  duration: { type: 'integer', example: 7 },
                  route: { type: 'string', example: 'oral' },
                  instructions: { type: 'string', example: 'Take with food' }
                }
              }
            },
            prescriptionDate: { type: 'string', format: 'date' },
            expiryDate: { type: 'string', format: 'date' }
          }
        },

        // Invoice schemas
        Invoice: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            patient: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  service: { type: 'string' },
                  description: { type: 'string' },
                  quantity: { type: 'integer' },
                  unitPrice: { type: 'number' },
                  totalPrice: { type: 'number' }
                }
              }
            },
            totalAmount: { type: 'number', example: 5000 },
            paidAmount: { type: 'number', example: 0 },
            balanceAmount: { type: 'number', example: 5000 },
            status: { type: 'string', enum: ['unpaid', 'partially_paid', 'paid'] },
            currency: { type: 'string', enum: ['CDF', 'USD'], example: 'CDF' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token required or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Authentication token required',
                statusCode: 401
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'You do not have permission to perform this action',
                statusCode: 403
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Resource not found',
                statusCode: 404
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Validation failed',
                statusCode: 422,
                details: {
                  validationErrors: [
                    { field: 'email', message: 'Invalid email format' }
                  ]
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'An internal server error occurred',
                statusCode: 500
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication and authorization' },
      { name: 'Patients', description: 'Patient management' },
      { name: 'Appointments', description: 'Appointment scheduling' },
      { name: 'Queue', description: 'Patient queue management' },
      { name: 'Prescriptions', description: 'Prescription management' },
      { name: 'Pharmacy', description: 'Pharmacy and medication dispensing' },
      { name: 'Invoices', description: 'Billing and invoicing' },
      { name: 'Ophthalmology', description: 'Ophthalmology examinations' },
      { name: 'Laboratory', description: 'Laboratory orders and results' },
      { name: 'Devices', description: 'Medical device integration' },
      { name: 'Documents', description: 'Document management' },
      { name: 'Backups', description: 'Backup management' },
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Admin', description: 'Administrative operations' }
    ]
  },
  // Paths to files containing OpenAPI definitions
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
