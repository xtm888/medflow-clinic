/**
 * Auth Middleware
 *
 * This middleware handles localStorage synchronization for authentication tokens.
 * Redux reducers must be pure functions, so we handle side effects here.
 *
 * This syncs the token to localStorage so that the API interceptor can access it
 * without being tightly coupled to Redux state.
 */

const authMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  // Handle actions that affect authentication tokens
  switch (action.type) {
    case 'auth/setCredentials': {
      const { token, refreshToken } = action.payload;
      if (token) {
        localStorage.setItem('token', token);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      break;
    }

    case 'auth/clearCredentials': {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      break;
    }

    // Handle successful login
    case 'auth/login/fulfilled': {
      const { token, refreshToken } = action.payload;
      if (token) {
        localStorage.setItem('token', token);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      break;
    }

    // Handle successful registration
    case 'auth/register/fulfilled': {
      const { token, refreshToken } = action.payload;
      if (token) {
        localStorage.setItem('token', token);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      break;
    }

    // Handle logout (success or failure)
    case 'auth/logout/fulfilled':
    case 'auth/logout/rejected': {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      break;
    }

    // Handle token refresh
    case 'auth/refreshToken/fulfilled': {
      const { token, refreshToken } = action.payload;
      if (token) {
        localStorage.setItem('token', token);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      break;
    }

    // Handle token refresh failure
    case 'auth/refreshToken/rejected': {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      break;
    }

    default:
      break;
  }

  return result;
};

export default authMiddleware;
