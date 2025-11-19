import { io } from 'socket.io-client';
import { store } from '../store';
import { addNotification } from '../store/slices/notificationSlice';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.connected = false;
  }

  connect(token) {
    if (this.socket && this.connected) {
      console.log('WebSocket already connected');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5001';

    this.socket = io(wsUrl, {
      auth: {
        token: token || localStorage.getItem('token'),
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Rejoin rooms if needed
      const user = store.getState().auth.user;
      if (user) {
        this.joinRoom(`user:${user.id}`);
        if (user.role) {
          this.joinRoom(`role:${user.role}`);
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.emit('max_reconnect_failed');
      }
    });

    // Application events
    this.socket.on('notification', (notification) => {
      store.dispatch(addNotification({
        ...notification,
        timestamp: new Date().toISOString(),
        read: false,
      }));
      this.emit('notification', notification);
    });

    this.socket.on('appointment_update', (data) => {
      this.emit('appointment_update', data);
    });

    this.socket.on('patient_update', (data) => {
      this.emit('patient_update', data);
    });

    this.socket.on('visit_update', (data) => {
      this.emit('visit_update', data);
    });

    this.socket.on('queue_update', (data) => {
      this.emit('queue_update', data);
    });

    this.socket.on('message', (data) => {
      this.emit('message', data);
    });

    this.socket.on('prescription_ready', (data) => {
      this.emit('prescription_ready', data);
    });

    this.socket.on('lab_results', (data) => {
      this.emit('lab_results', data);
    });

    this.socket.on('billing_update', (data) => {
      this.emit('billing_update', data);
    });

    this.socket.on('emergency_alert', (data) => {
      store.dispatch(addNotification({
        id: Date.now(),
        type: 'emergency',
        title: 'Emergency Alert',
        message: data.message,
        priority: 'high',
        timestamp: new Date().toISOString(),
        read: false,
      }));
      this.emit('emergency_alert', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((handler) => handler(data));
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  off(event, handler) {
    const handlers = this.listeners.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  // Socket.IO methods
  send(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected. Message not sent:', event, data);
    }
  }

  joinRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('join_room', room);
    }
  }

  leaveRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('leave_room', room);
    }
  }

  // Specific event emitters
  sendMessage(recipientId, message) {
    this.send('private_message', {
      recipientId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToRole(role, event, data) {
    this.send('broadcast_role', {
      role,
      event,
      data,
    });
  }

  updateQueuePosition(appointmentId, position) {
    this.send('update_queue', {
      appointmentId,
      position,
    });
  }

  notifyPatientCalled(patientId, room) {
    this.send('patient_called', {
      patientId,
      room,
      timestamp: new Date().toISOString(),
    });
  }

  requestAssistance(location, priority = 'normal') {
    this.send('assistance_request', {
      location,
      priority,
      timestamp: new Date().toISOString(),
    });
  }

  // Heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // Every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Get connection status
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Initialize store subscription - called after store is ready
let storeInitialized = false;
export const initWebSocketService = () => {
  if (storeInitialized) return;
  storeInitialized = true;

  // Auto-connect when user is authenticated
  const authState = store.getState().auth;
  if (authState.isAuthenticated && authState.token) {
    websocketService.connect(authState.token);
  }

  // Listen for auth changes
  let previousAuth = authState.isAuthenticated;
  store.subscribe(() => {
    const currentAuth = store.getState().auth.isAuthenticated;
    const token = store.getState().auth.token;

    if (!previousAuth && currentAuth && token) {
      // User logged in
      websocketService.connect(token);
      websocketService.startHeartbeat();
    } else if (previousAuth && !currentAuth) {
      // User logged out
      websocketService.stopHeartbeat();
      websocketService.disconnect();
    }

    previousAuth = currentAuth;
  });
};

// Defer initialization to avoid circular dependency
setTimeout(() => {
  try {
    initWebSocketService();
  } catch (e) {
    console.warn('WebSocket service initialization deferred');
  }
}, 0);

export default websocketService;