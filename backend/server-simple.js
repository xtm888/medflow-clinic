// Simplified server without dependencies for testing
const http = require('http');
const url = require('url');

// Mock data
const mockUser = {
  id: '1',
  username: 'admin',
  email: 'admin@medflow.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  department: 'administration',
  isEmailVerified: true
};

const mockPatients = [
  {
    id: '1',
    patientId: 'PAT20240001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1980-05-15',
    gender: 'male',
    phoneNumber: '+1234567890',
    email: 'john.doe@email.com',
    status: 'active'
  },
  {
    id: '2',
    patientId: 'PAT20240002',
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: '1975-08-22',
    gender: 'female',
    phoneNumber: '+1234567891',
    email: 'jane.smith@email.com',
    status: 'active'
  }
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// Simple router
const routes = {
  '/health': {
    GET: (req, res) => {
      respond(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: 'development'
      });
    }
  },
  '/api/auth/login': {
    POST: async (req, res) => {
      const body = await getBody(req);
      const { email, password } = body;

      // Simple mock authentication
      if (email === 'admin@medflow.com' && password === 'Admin123!') {
        respond(res, 200, {
          success: true,
          token: 'mock-jwt-token-' + Date.now(),
          user: mockUser,
          message: 'Login successful'
        });
      } else {
        respond(res, 401, {
          success: false,
          error: 'Invalid credentials'
        });
      }
    }
  },
  '/api/auth/me': {
    GET: (req, res) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer')) {
        respond(res, 200, {
          success: true,
          data: mockUser
        });
      } else {
        respond(res, 401, {
          success: false,
          error: 'Not authenticated'
        });
      }
    }
  },
  '/api/auth/logout': {
    POST: (req, res) => {
      respond(res, 200, {
        success: true,
        message: 'Logged out successfully'
      });
    }
  },
  '/api/patients': {
    GET: (req, res) => {
      respond(res, 200, {
        success: true,
        count: mockPatients.length,
        total: mockPatients.length,
        pages: 1,
        currentPage: 1,
        data: mockPatients
      });
    },
    POST: async (req, res) => {
      const body = await getBody(req);
      const newPatient = {
        id: String(mockPatients.length + 1),
        patientId: `PAT2024${String(mockPatients.length + 1).padStart(4, '0')}`,
        ...body,
        status: 'active'
      };
      mockPatients.push(newPatient);
      respond(res, 201, {
        success: true,
        data: newPatient
      });
    }
  },
  '/api/appointments/today': {
    GET: (req, res) => {
      respond(res, 200, {
        success: true,
        stats: {
          total: 15,
          scheduled: 5,
          checkedIn: 3,
          inProgress: 2,
          completed: 4,
          cancelled: 1,
          noShow: 0
        },
        data: []
      });
    }
  }
};

// Helper functions
function respond(res, statusCode, data) {
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Find matching route
  const route = routes[path];

  if (route && route[method]) {
    try {
      await route[method](req, res);
    } catch (error) {
      console.error('Route error:', error);
      respond(res, 500, {
        success: false,
        error: 'Internal server error'
      });
    }
  } else {
    // Check for dynamic routes (with IDs)
    const patientMatch = path.match(/^\/api\/patients\/(\d+)$/);
    if (patientMatch && method === 'GET') {
      const patient = mockPatients.find(p => p.id === patientMatch[1]);
      if (patient) {
        respond(res, 200, {
          success: true,
          data: patient
        });
      } else {
        respond(res, 404, {
          success: false,
          error: 'Patient not found'
        });
      }
    } else {
      respond(res, 404, {
        success: false,
        error: 'Route not found'
      });
    }
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Mock backend server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`✅ Health check at http://localhost:${PORT}/health`);
  console.log('\n📝 Available endpoints:');
  console.log('  - POST /api/auth/login');
  console.log('  - GET  /api/auth/me');
  console.log('  - POST /api/auth/logout');
  console.log('  - GET  /api/patients');
  console.log('  - POST /api/patients');
  console.log('  - GET  /api/appointments/today');
  console.log('\n🔑 Demo credentials:');
  console.log('  Email: admin@medflow.com');
  console.log('  Password: Admin123!');
});