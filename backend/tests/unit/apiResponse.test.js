/**
 * Unit Tests for API Response Utility
 *
 * Tests the standardized response helpers that ensure
 * consistent API response format across all endpoints.
 */

const {
  success,
  paginated,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  serverError,
  attachToResponse
} = require('../../utils/apiResponse');

// Mock Express response object
const createMockResponse = () => {
  const res = {
    statusCode: 200,
    data: null,
    status: jest.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function(data) {
      this.data = data;
      return this;
    })
  };
  return res;
};

describe('API Response Utility', () => {
  describe('success()', () => {
    test('should return 200 status by default', () => {
      const res = createMockResponse();
      success(res, { data: { id: 1 } });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.success).toBe(true);
    });

    test('should include data in response', () => {
      const res = createMockResponse();
      const testData = { users: [{ id: 1, name: 'Test' }] };
      success(res, { data: testData });

      expect(res.data.data).toEqual(testData);
    });

    test('should include message when provided', () => {
      const res = createMockResponse();
      success(res, { message: 'Operation successful' });

      expect(res.data.message).toBe('Operation successful');
    });

    test('should not include message when not provided', () => {
      const res = createMockResponse();
      success(res, { data: { id: 1 } });

      expect(res.data.message).toBeUndefined();
    });

    test('should allow custom status codes', () => {
      const res = createMockResponse();
      success(res, { statusCode: 201, data: { id: 1 } });

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should include meta with timestamp', () => {
      const res = createMockResponse();
      success(res, { data: {} });

      expect(res.data.meta).toBeDefined();
      expect(res.data.meta.timestamp).toBeDefined();
    });

    test('should merge custom meta', () => {
      const res = createMockResponse();
      success(res, { data: {}, meta: { requestId: 'abc123' } });

      expect(res.data.meta.requestId).toBe('abc123');
      expect(res.data.meta.timestamp).toBeDefined();
    });

    test('should include pagination when provided', () => {
      const res = createMockResponse();
      success(res, {
        data: [],
        pagination: { page: 1, limit: 20, total: 100 }
      });

      expect(res.data.pagination).toEqual({ page: 1, limit: 20, total: 100 });
    });
  });

  describe('paginated()', () => {
    test('should return paginated response with calculated pages', () => {
      const res = createMockResponse();
      paginated(res, {
        data: [1, 2, 3],
        page: 1,
        limit: 20,
        total: 100
      });

      expect(res.data.success).toBe(true);
      expect(res.data.pagination.page).toBe(1);
      expect(res.data.pagination.limit).toBe(20);
      expect(res.data.pagination.total).toBe(100);
      expect(res.data.pagination.pages).toBe(5);
      expect(res.data.pagination.hasMore).toBe(true);
    });

    test('should calculate hasMore correctly', () => {
      const res = createMockResponse();

      // Last page - no more
      paginated(res, { page: 5, limit: 20, total: 100, data: [] });
      expect(res.data.pagination.hasMore).toBe(false);

      // First page with more data
      const res2 = createMockResponse();
      paginated(res2, { page: 1, limit: 20, total: 100, data: [] });
      expect(res2.data.pagination.hasMore).toBe(true);
    });

    test('should handle string page/limit values', () => {
      const res = createMockResponse();
      paginated(res, {
        data: [],
        page: '2',
        limit: '10',
        total: 100
      });

      expect(res.data.pagination.page).toBe(2);
      expect(res.data.pagination.limit).toBe(10);
    });

    test('should handle zero total', () => {
      const res = createMockResponse();
      paginated(res, {
        data: [],
        page: 1,
        limit: 20,
        total: 0
      });

      expect(res.data.pagination.pages).toBe(0);
      expect(res.data.pagination.hasMore).toBe(false);
    });
  });

  describe('error()', () => {
    test('should return 500 status by default', () => {
      const res = createMockResponse();
      error(res, {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.data.success).toBe(false);
    });

    test('should include error message', () => {
      const res = createMockResponse();
      error(res, { error: 'Something went wrong' });

      expect(res.data.error).toBe('Something went wrong');
    });

    test('should include error code when provided', () => {
      const res = createMockResponse();
      error(res, { error: 'Not found', code: 'NOT_FOUND' });

      expect(res.data.code).toBe('NOT_FOUND');
    });

    test('should not include code when not provided', () => {
      const res = createMockResponse();
      error(res, { error: 'Error' });

      expect(res.data.code).toBeUndefined();
    });

    test('should include details in non-production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = createMockResponse();
      error(res, { error: 'Error', details: { stack: 'trace' } });

      expect(res.data.details).toEqual({ stack: 'trace' });

      process.env.NODE_ENV = originalEnv;
    });

    test('should exclude details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = createMockResponse();
      error(res, { error: 'Error', details: { stack: 'trace' } });

      expect(res.data.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should include meta with timestamp', () => {
      const res = createMockResponse();
      error(res, {});

      expect(res.data.meta).toBeDefined();
      expect(res.data.meta.timestamp).toBeDefined();
    });
  });

  describe('HTTP Status Helpers', () => {
    describe('badRequest()', () => {
      test('should return 400 status', () => {
        const res = createMockResponse();
        badRequest(res, 'Invalid input');

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.data.error).toBe('Invalid input');
        expect(res.data.code).toBe('BAD_REQUEST');
      });

      test('should use default message', () => {
        const res = createMockResponse();
        badRequest(res);

        expect(res.data.error).toBe('Bad request');
      });
    });

    describe('unauthorized()', () => {
      test('should return 401 status', () => {
        const res = createMockResponse();
        unauthorized(res, 'Invalid token');

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.data.error).toBe('Invalid token');
        expect(res.data.code).toBe('UNAUTHORIZED');
      });

      test('should use default message', () => {
        const res = createMockResponse();
        unauthorized(res);

        expect(res.data.error).toBe('Unauthorized');
      });
    });

    describe('forbidden()', () => {
      test('should return 403 status', () => {
        const res = createMockResponse();
        forbidden(res, 'Access denied');

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.data.error).toBe('Access denied');
        expect(res.data.code).toBe('FORBIDDEN');
      });
    });

    describe('notFound()', () => {
      test('should return 404 status', () => {
        const res = createMockResponse();
        notFound(res, 'Patient');

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.data.error).toBe('Patient not found');
        expect(res.data.code).toBe('NOT_FOUND');
      });

      test('should use default resource name', () => {
        const res = createMockResponse();
        notFound(res);

        expect(res.data.error).toBe('Resource not found');
      });
    });

    describe('conflict()', () => {
      test('should return 409 status', () => {
        const res = createMockResponse();
        conflict(res, 'Duplicate entry');

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.data.error).toBe('Duplicate entry');
        expect(res.data.code).toBe('CONFLICT');
      });
    });

    describe('validationError()', () => {
      test('should return 422 status with validation errors', () => {
        const res = createMockResponse();
        const errors = [
          { field: 'email', message: 'Invalid email format' },
          { field: 'phone', message: 'Phone number required' }
        ];
        validationError(res, errors);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.data.error).toBe('Validation failed');
        expect(res.data.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('serverError()', () => {
      test('should return 500 status', () => {
        const res = createMockResponse();
        serverError(res, 'Database connection failed');

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.data.error).toBe('Database connection failed');
        expect(res.data.code).toBe('SERVER_ERROR');
      });

      test('should use default message', () => {
        const res = createMockResponse();
        serverError(res);

        expect(res.data.error).toBe('Internal server error');
      });
    });
  });

  describe('attachToResponse middleware', () => {
    test('should attach api helpers to response', () => {
      const req = {};
      const res = createMockResponse();
      const next = jest.fn();

      attachToResponse(req, res, next);

      expect(res.api).toBeDefined();
      expect(typeof res.api.success).toBe('function');
      expect(typeof res.api.error).toBe('function');
      expect(typeof res.api.paginated).toBe('function');
      expect(typeof res.api.badRequest).toBe('function');
      expect(typeof res.api.unauthorized).toBe('function');
      expect(typeof res.api.forbidden).toBe('function');
      expect(typeof res.api.notFound).toBe('function');
      expect(typeof res.api.conflict).toBe('function');
      expect(typeof res.api.validationError).toBe('function');
      expect(typeof res.api.serverError).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    test('attached helpers should work correctly', () => {
      const req = {};
      const res = createMockResponse();
      const next = jest.fn();

      attachToResponse(req, res, next);
      res.api.success({ data: { id: 1 } });

      expect(res.data.success).toBe(true);
      expect(res.data.data).toEqual({ id: 1 });
    });
  });

  describe('Response Format Consistency', () => {
    test('all success responses should have success: true', () => {
      const res1 = createMockResponse();
      success(res1, {});
      expect(res1.data.success).toBe(true);

      const res2 = createMockResponse();
      paginated(res2, { data: [], page: 1, limit: 20, total: 0 });
      expect(res2.data.success).toBe(true);
    });

    test('all error responses should have success: false', () => {
      const helpers = [
        (res) => error(res, {}),
        (res) => badRequest(res),
        (res) => unauthorized(res),
        (res) => forbidden(res),
        (res) => notFound(res),
        (res) => conflict(res),
        (res) => validationError(res),
        (res) => serverError(res)
      ];

      helpers.forEach(helper => {
        const res = createMockResponse();
        helper(res);
        expect(res.data.success).toBe(false);
      });
    });

    test('all responses should have meta.timestamp', () => {
      const res1 = createMockResponse();
      success(res1, {});
      expect(res1.data.meta.timestamp).toBeDefined();

      const res2 = createMockResponse();
      error(res2, {});
      expect(res2.data.meta.timestamp).toBeDefined();
    });
  });
});
