import { io } from 'socket.io-client';
import { throttle, queueUpdate } from '../utils/performance';

// Store reference - will be set lazily to avoid circular dependency
let storeRef = null;
let sliceActionsRef = null;
let storeInitPromise = null;

const getStore = () => {
  if (storeRef) return storeRef;

  // Try to import store synchronously if available
  if (!storeInitPromise) {
    storeInitPromise = Promise.all([
      import('../store'),
      import('../store/slices/notificationSlice'),
      import('../store/slices/queueSlice'),
      import('../store/slices/patientSlice'),
      import('../store/slices/visitSlice')
    ]).then(([storeModule, notificationModule, queueModule, patientModule, visitModule]) => {
      storeRef = storeModule.store;
      sliceActionsRef = {
        addNotification: notificationModule.addNotification,
        updateQueueRealtime: queueModule.updateQueueRealtime,
        updatePatientInList: patientModule.updatePatientInList,
        updateVisitInList: visitModule.updateVisitInList
      };
      return storeRef;
    }).catch(e => {
      console.error('[WebSocket] Failed to load store:', e);
      return null;
    });
  }

  return storeRef;
};

// Helper to get slice actions
const getSliceActions = () => sliceActionsRef;

// Initialize store on first access
getStore();

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.connected = false;

    // Message replay tracking
    this.lastSeenTimestamp = this.loadLastSeen();
    this.isReplaying = false;
    this.replayedMessageIds = new Set();

    // Pending handler emissions (batched via microtask)
    this.pendingEmissions = [];
    this.emissionScheduled = false;

    // Throttled Redux dispatch to prevent cascading updates (100ms)
    this.throttledDispatch = throttle((action) => {
      const storeInstance = getStore();
      if (storeInstance) {
        storeInstance.dispatch(action);
      }
    }, 100);

    console.log('[WebSocket] Service instantiated');
  }

  // Load last seen timestamp from localStorage
  loadLastSeen() {
    try {
      const saved = localStorage.getItem('ws_last_seen');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  }

  // Save last seen timestamp to localStorage
  saveLastSeen(timestamp) {
    try {
      localStorage.setItem('ws_last_seen', timestamp.toString());
      this.lastSeenTimestamp = timestamp;
    } catch {
      // Ignore storage errors
    }
  }

  connect(token) {
    console.log('[WebSocket] connect() called');

    if (this.socket && this.connected) {
      console.log('[WebSocket] Already connected, skipping');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5001`;
    const authToken = token || localStorage.getItem('token');

    console.log('[WebSocket] Connecting to:', wsUrl);
    console.log('[WebSocket] Token present:', !!authToken);

    if (!authToken) {
      console.warn('[WebSocket] No auth token, cannot connect');
      return;
    }

    this.socket = io(wsUrl, {
      auth: {
        token: authToken,
      },
      transports: ['websocket', 'polling'],
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
      console.log('[WebSocket] Connected successfully');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Rejoin rooms if needed
      try {
        const storeInstance = getStore();
        const user = storeInstance?.getState()?.auth?.user;
        if (user) {
          this.joinRoom(`user:${user.id}`);
          if (user.role) {
            this.joinRoom(`role:${user.role}`);
          }
        }
      } catch (e) {
        console.warn('[WebSocket] Could not get user for room join:', e);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;
      // Save timestamp when disconnected for replay on reconnect
      this.saveLastSeen(Date.now());
      this.emit('disconnected', reason);
    });

    // Message replay events
    this.socket.on('replay:start', (data) => {
      console.log(`[WebSocket] Replay starting: ${data.count} missed messages since ${new Date(data.since).toISOString()}`);
      this.isReplaying = true;
      this.emit('replay:start', data);
    });

    this.socket.on('replay:complete', (data) => {
      console.log(`[WebSocket] Replay complete: ${data.count} messages replayed`);
      this.isReplaying = false;
      this.replayedMessageIds.clear();
      this.emit('replay:complete', data);
    });

    this.socket.on('replay:response', (data) => {
      console.log(`[WebSocket] Replay response for ${data.room}: ${data.count} messages`);
      if (data.messages) {
        data.messages.forEach(msg => {
          this.handleReplayedMessage(msg);
        });
      }
      this.emit('replay:response', data);
    });

    this.socket.on('replay:queue', (messages) => {
      console.log(`[WebSocket] Queue replay: ${messages.length} messages`);
      messages.forEach(msg => {
        if (msg.event === 'queue:update') {
          this.emit('queue_update', { ...msg.data, _replayed: true });
        }
      });
    });

    // Permission change handler - forces logout when permissions updated
    this.socket.on('permission:change', (data) => {
      console.log(`[WebSocket] Permission change for role: ${data.role}`);

      // Check if current user's role matches
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user?.role === data.role) {
        // Show notification
        console.warn('Your permissions were updated. Logging out...');

        // Force logout after 2 seconds
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login?reason=permissions_updated';
        }, 2000);
      }
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
      try {
        const storeInstance = getStore();
        const actions = getSliceActions();
        if (storeInstance && actions?.addNotification) {
          storeInstance.dispatch(actions.addNotification({
            ...notification,
            timestamp: new Date().toISOString(),
            read: false,
          }));
        }
      } catch (e) {
        console.warn('[WebSocket] Could not dispatch notification:', e);
      }
      this.emit('notification', notification);
    });

    this.socket.on('appointment_update', (data) => {
      this.emit('appointment_update', data);
    });

    this.socket.on('patient_update', (data) => {
      // Dispatch to Redux for real-time patient updates
      try {
        const storeInstance = getStore();
        const actions = getSliceActions();
        if (storeInstance && actions?.updatePatientInList && data?.patient) {
          storeInstance.dispatch(actions.updatePatientInList(data.patient));
        }
      } catch (e) {
        console.warn('[WebSocket] Could not dispatch patient update:', e);
      }
      this.emit('patient_update', data);
    });

    this.socket.on('visit_update', (data) => {
      // Dispatch to Redux for real-time visit updates
      try {
        const storeInstance = getStore();
        const actions = getSliceActions();
        if (storeInstance && actions?.updateVisitInList && data?.visit) {
          storeInstance.dispatch(actions.updateVisitInList(data.visit));
        }
      } catch (e) {
        console.warn('[WebSocket] Could not dispatch visit update:', e);
      }
      this.emit('visit_update', data);
    });

    this.socket.on('queue_update', (data) => {
      // Use throttled dispatch for real-time queue updates to prevent cascading re-renders
      try {
        const actions = getSliceActions();
        if (actions?.updateQueueRealtime) {
          this.throttledDispatch(actions.updateQueueRealtime(data));
        }
      } catch (e) {
        console.warn('[WebSocket] Could not dispatch queue update:', e);
      }
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
      try {
        const storeInstance = getStore();
        const actions = getSliceActions();
        if (storeInstance && actions?.addNotification) {
          storeInstance.dispatch(actions.addNotification({
            id: Date.now(),
            type: 'emergency',
            title: 'Emergency Alert',
            message: data.message,
            priority: 'high',
            timestamp: new Date().toISOString(),
            read: false,
          }));
        }
      } catch (e) {
        console.warn('[WebSocket] Could not dispatch emergency alert:', e);
      }
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
    // Queue emissions to batch them in a microtask
    this.pendingEmissions.push({ event, data });

    if (!this.emissionScheduled) {
      this.emissionScheduled = true;
      queueUpdate(() => {
        this.processPendingEmissions();
      });
    }
  }

  // Process all pending emissions in a single batch
  processPendingEmissions() {
    const emissions = this.pendingEmissions;
    this.pendingEmissions = [];
    this.emissionScheduled = false;

    // Group emissions by event to avoid duplicate handler calls
    const grouped = new Map();
    emissions.forEach(({ event, data }) => {
      if (!grouped.has(event)) {
        grouped.set(event, []);
      }
      grouped.get(event).push(data);
    });

    // Call handlers with the latest data for each event
    grouped.forEach((dataArray, event) => {
      const handlers = this.listeners.get(event) || [];
      const latestData = dataArray[dataArray.length - 1]; // Use latest data
      handlers.forEach((handler) => {
        try {
          handler(latestData);
        } catch (e) {
          console.warn(`[WebSocket] Handler error for ${event}:`, e);
        }
      });
    });
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

  // Handle a replayed message from the server
  handleReplayedMessage(msg) {
    if (this.replayedMessageIds.has(msg.id)) {
      return; // Already handled
    }
    this.replayedMessageIds.add(msg.id);

    // Emit the event with _replayed flag so handlers can distinguish
    this.emit(msg.event.replace(':', '_'), { ...msg.data, _replayed: true, _originalTimestamp: msg.timestamp });
  }

  // Request replay of missed messages
  requestReplay(options = {}) {
    const { room, type = 'user', since } = options;
    const timestamp = since || this.lastSeenTimestamp || 0;

    if (this.socket && this.connected) {
      this.socket.emit('replay:request', { room, type, since: timestamp });
    }
  }

  // Subscribe to queue with replay support
  subscribeToQueue(lastSeen = null) {
    if (this.socket && this.connected) {
      this.socket.emit('subscribe:queue', { lastSeen: lastSeen || this.lastSeenTimestamp });
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
// Note: This is no longer auto-called. The useWebSocket hook handles connection.
let storeInitialized = false;
export const initWebSocketService = () => {
  if (storeInitialized) return;

  console.log('[WebSocket] initWebSocketService called');

  try {
    const storeInstance = getStore();
    if (!storeInstance) {
      console.warn('[WebSocket] Store not available yet');
      return;
    }

    storeInitialized = true;

    // Auto-connect when user is authenticated
    const authState = storeInstance.getState().auth;
    console.log('[WebSocket] Auth state:', { isAuthenticated: authState?.isAuthenticated, hasToken: !!authState?.token });

    if (authState?.isAuthenticated && authState?.token) {
      websocketService.connect(authState.token);
      websocketService.startHeartbeat();
    }

    // Listen for auth changes
    let previousAuth = authState?.isAuthenticated || false;
    storeInstance.subscribe(() => {
      const currentAuth = storeInstance.getState().auth?.isAuthenticated;
      const token = storeInstance.getState().auth?.token;

      if (!previousAuth && currentAuth && token) {
        // User logged in
        console.log('[WebSocket] User logged in, connecting...');
        websocketService.connect(token);
        websocketService.startHeartbeat();
      } else if (previousAuth && !currentAuth) {
        // User logged out
        console.log('[WebSocket] User logged out, disconnecting...');
        websocketService.stopHeartbeat();
        websocketService.disconnect();
      }

      previousAuth = currentAuth;
    });
  } catch (e) {
    console.error('[WebSocket] Init error:', e);
  }
};

// Don't auto-initialize - let the useWebSocket hook handle it
// This avoids timing issues with redux-persist rehydration

export default websocketService;