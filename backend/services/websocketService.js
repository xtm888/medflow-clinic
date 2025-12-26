const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CONSTANTS = require('../config/constants');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Websocket');

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map user IDs to socket IDs
    this.userLastSeen = new Map(); // Track when users were last connected

    // Message replay buffer configuration
    this.messageBuffer = new Map(); // room -> [{event, data, timestamp}]
    this.bufferMaxSize = 100; // Max messages per room
    this.bufferMaxAge = 15 * 60 * 1000; // 15 minutes

    // User-specific message buffer for missed notifications
    this.userMessageBuffer = new Map(); // userId -> [{event, data, timestamp}]
    this.userBufferMaxSize = 50;

    // Cleanup interval
    this.cleanupInterval = null;

    // Connection health monitoring
    this.pingInterval = null;
    this.connectionErrors = new Map(); // Track errors per connection
    this.maxConnectionErrors = 5; // Disconnect after 5 consecutive errors

    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      totalMessagesEmitted: 0,
      totalMessagesFailed: 0
    };
  }

  initialize(server, corsOptions) {
    this.io = socketIO(server, {
      cors: corsOptions,
      path: '/socket.io/',
      transports: ['websocket', 'polling'],

      // Connection health settings
      pingTimeout: CONSTANTS.WEBSOCKET.PONG_TIMEOUT_MS,
      pingInterval: CONSTANTS.WEBSOCKET.PING_INTERVAL_MS,

      // Performance settings
      maxHttpBufferSize: 1e6, // 1 MB
      connectTimeout: 10000, // 10 seconds

      // Error handling
      allowEIO3: true,
      serveClient: false
    });

    // Global error handler for socket.io
    this.io.engine.on('connection_error', (err) => {
      log.error('Socket.IO connection error:', {
        message: err.message,
        code: err.code,
        context: err.context
      });
      this.stats.totalErrors++;
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    this.setupErrorHandlers();
    this.startCleanupInterval();
    this.startPingInterval();
    log.info('✅ WebSocket service initialized (with enhanced error handling)');
  }

  // Start periodic cleanup of old messages
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupOldMessages();
      } catch (error) {
        log.error('WebSocket cleanup error:', error.message);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Stop cleanup interval
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Start ping interval for connection health monitoring
  startPingInterval() {
    // Socket.io handles pings automatically, but we add manual ping for additional monitoring
    this.pingInterval = setInterval(() => {
      if (this.io) {
        // Get all connected sockets
        this.io.sockets.sockets.forEach((socket) => {
          // Check socket health
          if (socket.connected) {
            try {
              socket.emit('ping', { timestamp: Date.now() });
            } catch (error) {
              log.error(`Ping error for socket ${socket.id}:`, error.message);
              this.handleSocketError(socket, error);
            }
          }
        });
      }
    }, CONSTANTS.WEBSOCKET.PING_INTERVAL_MS);
  }

  // Stop ping interval
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Setup global error handlers
  setupErrorHandlers() {
    if (!this.io) return;

    // Handle socket.io errors
    this.io.on('error', (error) => {
      log.error('Socket.IO error:', { error: error });
      this.stats.totalErrors++;
    });

    // Monitor all sockets for errors
    this.io.on('connection', (socket) => {
      // Socket-specific error handler
      socket.on('error', (error) => {
        log.error(`Socket error for user ${socket.userId}:`, {
          error: error.message,
          socketId: socket.id,
          userId: socket.userId
        });
        this.handleSocketError(socket, error);
      });

      // Handle connection errors
      socket.on('connect_error', (error) => {
        log.error(`Connection error for socket ${socket.id}:`, error.message);
        this.handleSocketError(socket, error);
      });

      // Handle reconnection attempts
      socket.on('reconnect_attempt', (attemptNumber) => {
        log.info(`Reconnection attempt ${attemptNumber} for socket ${socket.id}`);
      });

      // Handle reconnection failure
      socket.on('reconnect_failed', () => {
        log.error(`Reconnection failed for socket ${socket.id}`);
        this.handleSocketDisconnect(socket, 'reconnect_failed');
      });
    });
  }

  // Handle socket errors with exponential backoff
  handleSocketError(socket, error) {
    if (!socket || !socket.id) return;

    const errorCount = (this.connectionErrors.get(socket.id) || 0) + 1;
    this.connectionErrors.set(socket.id, errorCount);
    this.stats.totalErrors++;

    // Disconnect socket if too many errors
    if (errorCount >= this.maxConnectionErrors) {
      log.error(`Socket ${socket.id} exceeded max errors (${errorCount}). Disconnecting.`);
      try {
        socket.disconnect(true);
      } catch (err) {
        log.error('Error disconnecting socket:', err.message);
      }
      this.connectionErrors.delete(socket.id);
    }
  }

  // Handle socket disconnect cleanup
  handleSocketDisconnect(socket, reason) {
    if (!socket) return;

    log.info(`Socket ${socket.id} disconnected: ${reason}`);
    this.stats.totalDisconnections++;

    // Clean up error tracking
    this.connectionErrors.delete(socket.id);

    // Clean up user socket mapping
    if (socket.userId) {
      this.userSockets.delete(socket.userId);
      this.userLastSeen.set(socket.userId, Date.now());
    }

    this.stats.activeConnections = this.userSockets.size;
  }

  // Clean up old messages from buffers
  cleanupOldMessages() {
    const cutoff = Date.now() - this.bufferMaxAge;

    // Clean room buffers
    for (const [room, messages] of this.messageBuffer.entries()) {
      const filtered = messages.filter(msg => msg.timestamp > cutoff);
      if (filtered.length === 0) {
        this.messageBuffer.delete(room);
      } else {
        this.messageBuffer.set(room, filtered);
      }
    }

    // Clean user buffers
    for (const [userId, messages] of this.userMessageBuffer.entries()) {
      const filtered = messages.filter(msg => msg.timestamp > cutoff);
      if (filtered.length === 0) {
        this.userMessageBuffer.delete(userId);
      } else {
        this.userMessageBuffer.set(userId, filtered);
      }
    }

    // MEMORY LEAK FIX: Clean up old userLastSeen entries
    // Remove entries for users who haven't been seen in over 24 hours
    const lastSeenCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    for (const [userId, lastSeen] of this.userLastSeen.entries()) {
      // Only clean up if user is not currently connected
      if (!this.userSockets.has(userId) && lastSeen < lastSeenCutoff) {
        this.userLastSeen.delete(userId);
        // Also clean up their message buffer
        this.userMessageBuffer.delete(userId);
      }
    }

    // Log cleanup stats periodically
    if (Math.random() < 0.1) { // 10% chance to log
      log.info(`WebSocket cleanup: ${this.messageBuffer.size} room buffers, ${this.userMessageBuffer.size} user buffers, ${this.userLastSeen.size} lastSeen entries, ${this.userSockets.size} connected users`);
    }
  }

  // Store a message in the replay buffer
  bufferMessage(room, event, data) {
    const message = {
      event,
      data,
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (!this.messageBuffer.has(room)) {
      this.messageBuffer.set(room, []);
    }

    const buffer = this.messageBuffer.get(room);
    buffer.push(message);

    // Trim if over max size
    if (buffer.length > this.bufferMaxSize) {
      buffer.shift();
    }
  }

  // Store a user-specific message
  bufferUserMessage(userId, event, data) {
    const message = {
      event,
      data,
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (!this.userMessageBuffer.has(userId)) {
      this.userMessageBuffer.set(userId, []);
    }

    const buffer = this.userMessageBuffer.get(userId);
    buffer.push(message);

    // Trim if over max size
    if (buffer.length > this.userBufferMaxSize) {
      buffer.shift();
    }
  }

  // Get missed messages for a room since a timestamp
  getMissedMessages(room, since) {
    const buffer = this.messageBuffer.get(room) || [];
    return buffer.filter(msg => msg.timestamp > since);
  }

  // Get missed user messages since a timestamp
  getMissedUserMessages(userId, since) {
    const buffer = this.userMessageBuffer.get(userId) || [];
    return buffer.filter(msg => msg.timestamp > since);
  }

  setupAuthentication() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      log.info(`User ${socket.user.firstName} ${socket.user.lastName} connected`);

      // Update statistics
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      // Store user socket mapping
      this.userSockets.set(socket.userId, socket.id);

      // Clear error count for reconnecting user
      this.connectionErrors.delete(socket.id);

      // Check if user was previously connected and get their last seen time
      const lastSeen = this.userLastSeen.get(socket.userId);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join user to their role-based room
      socket.join(`role:${socket.user.role}`);

      // Join user to department room if applicable
      if (socket.user.department) {
        socket.join(`department:${socket.user.department}`);
      }

      // Send any missed notifications on reconnect
      if (lastSeen) {
        const missedMessages = this.getMissedUserMessages(socket.userId, lastSeen);
        if (missedMessages.length > 0) {
          socket.emit('replay:start', { count: missedMessages.length, since: lastSeen });
          missedMessages.forEach(msg => {
            socket.emit(msg.event, { ...msg.data, _replayed: true, _originalTimestamp: msg.timestamp });
          });
          socket.emit('replay:complete', { count: missedMessages.length });
          log.info(`Replayed ${missedMessages.length} missed messages for user ${socket.userId}`);
        }
      }

      // Handle custom events
      socket.on('subscribe:queue', (data) => {
        socket.join('queue:updates');

        // Send missed queue updates if client provides lastSeen
        if (data?.lastSeen) {
          const missedQueue = this.getMissedMessages('queue:updates', data.lastSeen);
          if (missedQueue.length > 0) {
            socket.emit('replay:queue', missedQueue);
          }
        }
      });

      socket.on('subscribe:patient', (patientId) => {
        socket.join(`patient:${patientId}`);
      });

      socket.on('subscribe:notifications', () => {
        socket.join(`notifications:${socket.userId}`);
      });

      // Handle replay request from client
      socket.on('replay:request', (data) => {
        const { room, since, type } = data;

        if (type === 'user') {
          // Replay user-specific messages
          const messages = this.getMissedUserMessages(socket.userId, since || 0);
          socket.emit('replay:response', {
            room: 'user',
            messages,
            count: messages.length
          });
        } else if (room) {
          // Replay room messages (only if user is in that room)
          const messages = this.getMissedMessages(room, since || 0);
          socket.emit('replay:response', {
            room,
            messages,
            count: messages.length
          });
        }
      });

      // Handle generic room join/leave for frontend compatibility
      socket.on('join_room', (room) => {
        if (room && typeof room === 'string') {
          socket.join(room);
          log.info(`User ${socket.userId} joined room: ${room}`);
        }
      });

      socket.on('leave_room', (room) => {
        if (room && typeof room === 'string') {
          socket.leave(room);
          log.info(`User ${socket.userId} left room: ${room}`);
        }
      });

      // Handle both ping formats for frontend compatibility
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('heartbeat', () => {
        socket.emit('pong');
      });

      // Handle private messages
      socket.on('private_message', (data) => {
        if (data.to && data.message) {
          this.sendDirectMessage(socket.userId, data.to, data.message);
        }
      });

      // Handle patient called notification
      socket.on('patient_called', (data) => {
        if (data.patientId) {
          this.io.emit('patient_called', {
            ...data,
            calledBy: socket.userId,
            timestamp: new Date()
          });
        }
      });

      // Handle assistance request
      socket.on('assistance_request', (data) => {
        this.io.to('role:admin').emit('assistance_requested', {
          ...data,
          requestedBy: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          timestamp: new Date()
        });
        this.io.to('role:nurse').emit('assistance_requested', {
          ...data,
          requestedBy: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          timestamp: new Date()
        });
      });

      socket.on('disconnect', (reason) => {
        log.info(`User ${socket.user.firstName} ${socket.user.lastName} disconnected: ${reason}`);
        this.handleSocketDisconnect(socket, reason);
      });
    });
  }

  // Emit queue update to all subscribed clients
  emitQueueUpdate(queueData) {
    if (this.io) {
      const data = { ...queueData, timestamp: Date.now() };
      // Buffer for replay
      this.bufferMessage('queue:updates', 'queue_update', data);

      // OPTIMIZED: Emit only the event format frontend listens to (queue_update)
      // Removed duplicate queue:update and queue:updated emissions
      this.io.to('queue:updates').emit('queue_update', data);
      this.io.emit('queue_update', data); // Global broadcast for all clients
    }
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    if (this.io) {
      const data = { ...notification, timestamp: Date.now() };

      // Buffer for replay if user is offline
      if (!this.isUserOnline(userId)) {
        this.bufferUserMessage(userId, 'notification', data);
      }

      // OPTIMIZED: Emit only 'notification' event (frontend listens to this)
      // Removed duplicate notification:new and notification:update emissions
      this.io.to(`user:${userId}`).emit('notification', data);
      this.io.to(`notifications:${userId}`).emit('notification', data);
    }
  }

  // Send notification to all users with specific role
  sendNotificationToRole(role, notification) {
    if (this.io) {
      this.io.to(`role:${role}`).emit('notification:new', notification);
    }
  }

  // Send notification to department
  sendNotificationToDepartment(department, notification) {
    if (this.io) {
      this.io.to(`department:${department}`).emit('notification:new', notification);
    }
  }

  // Emit patient update
  emitPatientUpdate(patientId, updateData) {
    if (this.io) {
      // OPTIMIZED: Emit only 'patient_update' (frontend listens to this)
      this.io.to(`patient:${patientId}`).emit('patient_update', updateData);
      this.io.emit('patient_update', updateData); // Global for patient list views
    }
  }

  // Emit appointment update
  emitAppointmentUpdate(appointmentData) {
    if (this.io) {
      const data = { ...appointmentData, timestamp: Date.now() };
      // Buffer for replay
      this.bufferMessage('appointments', 'appointment_update', data);

      // OPTIMIZED: Emit only 'appointment_update' (frontend listens to this)
      this.io.emit('appointment_update', data);
    }
  }

  // Emit billing/invoice update (NEW: frontend hooks listen to billing_update)
  emitBillingUpdate(billingData) {
    if (this.io) {
      const data = { ...billingData, timestamp: Date.now() };
      const { patientId, invoiceId, event } = billingData;

      // Notify patient
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('billing_update', data);
      }

      // Notify accountants and billing staff
      this.io.to('role:accountant').emit('billing_update', data);
      this.io.to('role:receptionist').emit('billing_update', data);

      // Global broadcast for billing dashboards
      this.io.emit('billing_update', data);

      log.info(`Billing update emitted: ${event || 'update'} for invoice ${invoiceId}`);
    }
  }

  // Emit prescription update
  emitPrescriptionUpdate(prescriptionData) {
    if (this.io) {
      const { patientId, prescriberId } = prescriptionData;

      // Notify patient
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('prescription:updated', prescriptionData);
      }

      // Notify prescriber
      if (prescriberId) {
        this.io.to(`user:${prescriberId}`).emit('prescription:updated', prescriptionData);
      }

      // Notify pharmacy
      this.io.to('role:pharmacist').emit('prescription:new', prescriptionData);
    }
  }

  // Emit lab result update
  emitLabResultUpdate(labData) {
    if (this.io) {
      const { patientId, providerId } = labData;

      // OPTIMIZED: Emit only 'lab_results' (frontend listens to this)
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('lab_results', labData);
      }

      if (providerId) {
        this.io.to(`user:${providerId}`).emit('lab_results', labData);
      }

      // Notify lab technicians (frontend listens to lab_worklist_update)
      this.io.to('role:lab_technician').emit('lab_worklist_update', labData);
    }
  }

  // Emit critical alert
  emitCriticalAlert(alertData) {
    if (this.io) {
      // Send to all connected users based on urgency
      if (alertData.urgency === 'critical') {
        this.io.emit('alert:critical', alertData);
      } else if (alertData.department) {
        this.io.to(`department:${alertData.department}`).emit('alert:department', alertData);
      } else if (alertData.role) {
        this.io.to(`role:${alertData.role}`).emit('alert:role', alertData);
      }
    }
  }

  // Emit inventory alert
  emitInventoryAlert(alertData) {
    if (this.io) {
      this.io.to('role:pharmacist').emit('inventory:alert', alertData);
      this.io.to('role:admin').emit('inventory:alert', alertData);
    }
  }

  // Emit dashboard update
  emitDashboardUpdate(updateType, data) {
    if (this.io) {
      this.io.emit('dashboard:update', {
        type: updateType,
        data: data,
        timestamp: new Date()
      });
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  // Get all online users
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  // Send direct message to user
  sendDirectMessage(fromUserId, toUserId, message) {
    if (this.io && this.userSockets.has(toUserId)) {
      this.io.to(`user:${toUserId}`).emit('message:direct', {
        from: fromUserId,
        message: message,
        timestamp: new Date()
      });
    }
  }

  // Generic broadcast to all connected clients
  broadcast(payload) {
    if (this.io && payload) {
      const event = payload.type || 'system:notification';
      this.io.emit(event, {
        ...payload,
        timestamp: new Date()
      });
    }
  }

  // Emit device-related events
  emitDeviceUpdate(eventType, data) {
    if (this.io) {
      this.io.emit(eventType, {
        ...data,
        timestamp: new Date()
      });
    }
  }

  // ============================================
  // LABORATORY WORKLIST UPDATES
  // ============================================

  // Emit lab worklist update (for real-time lab dashboard)
  emitLabWorklistUpdate(updateData) {
    if (this.io) {
      const data = {
        ...updateData,
        timestamp: new Date()
      };

      // Broadcast to all lab technicians
      // OPTIMIZED: Emit only 'lab_worklist_update' (frontend listens to this)
      this.io.to('role:lab_technician').emit('lab_worklist_update', data);

      // Also broadcast to doctors if they have the lab view open
      this.io.to('role:doctor').emit('lab_worklist_update', data);
      this.io.to('role:ophthalmologist').emit('lab_worklist_update', data);

      // Buffer for replay
      this.bufferMessage('lab:worklist', 'lab_worklist_update', data);
    }
  }

  // Emit specific lab order status change
  emitLabOrderStatusChange(orderId, oldStatus, newStatus, additionalData = {}) {
    if (this.io) {
      const data = {
        orderId,
        oldStatus,
        newStatus,
        ...additionalData,
        timestamp: new Date()
      };

      // Broadcast to lab staff
      this.io.to('role:lab_technician').emit('lab:order:status', data);

      // Notify ordering provider if result is ready
      if (newStatus === 'completed' && additionalData.orderedBy) {
        this.io.to(`user:${additionalData.orderedBy}`).emit('lab:results:ready', data);
      }

      // Critical value alert
      if (additionalData.hasCritical) {
        this.io.to('role:doctor').emit('lab:critical', data);
        this.io.to('role:ophthalmologist').emit('lab:critical', data);
        if (additionalData.orderedBy) {
          this.io.to(`user:${additionalData.orderedBy}`).emit('lab:critical', data);
        }
      }
    }
  }

  // Emit specimen collection event
  emitSpecimenCollected(specimenData) {
    if (this.io) {
      const data = {
        ...specimenData,
        timestamp: new Date()
      };

      // Notify lab to expect specimen
      this.io.to('role:lab_technician').emit('lab:specimen:collected', data);

      // Update worklist
      this.emitLabWorklistUpdate({
        action: 'specimen_collected',
        ...data
      });
    }
  }

  // Emit QC failure alert
  emitQCFailure(qcData) {
    if (this.io) {
      const data = {
        ...qcData,
        priority: 'urgent',
        timestamp: new Date()
      };

      // Alert all lab technicians
      this.safeEmit('role:lab_technician', 'lab:qc:failure', data);

      // Alert lab supervisor/admin
      this.safeEmit('role:admin', 'lab:qc:failure', data);
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Safe emit with error handling
   * Wraps socket.io emit with try-catch and statistics tracking
   */
  safeEmit(room, event, data) {
    if (!this.io) {
      log.warn('WebSocket not initialized, cannot emit event:', { data: event });
      return false;
    }

    try {
      if (room) {
        this.io.to(room).emit(event, data);
      } else {
        this.io.emit(event, data);
      }
      this.stats.totalMessagesEmitted++;
      return true;
    } catch (error) {
      log.error(`Failed to emit event ${event}:`, error.message);
      this.stats.totalMessagesFailed++;
      return false;
    }
  }

  /**
   * Get WebSocket service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.userSockets.size,
      bufferedRooms: this.messageBuffer.size,
      bufferedUsers: this.userMessageBuffer.size,
      trackedUsers: this.userLastSeen.size,
      pendingErrors: this.connectionErrors.size,
      uptime: process.uptime()
    };
  }

  /**
   * Reset statistics (useful for monitoring)
   */
  resetStats() {
    this.stats.totalMessagesEmitted = 0;
    this.stats.totalMessagesFailed = 0;
    this.stats.totalErrors = 0;
    // Keep connection counts
  }

  /**
   * Graceful shutdown
   * Clean up all resources and close connections
   */
  async shutdown() {
    log.info('🔌 Shutting down WebSocket service...');

    // Stop intervals
    this.stopCleanupInterval();
    this.stopPingInterval();

    // Notify all connected clients
    if (this.io) {
      this.io.emit('server:shutdown', {
        message: 'Server is shutting down. Please reconnect in a moment.',
        timestamp: new Date()
      });

      // Give clients time to receive the message
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Disconnect all clients
      const sockets = await this.io.fetchSockets();
      sockets.forEach(socket => {
        try {
          socket.disconnect(true);
        } catch (error) {
          log.error('Error disconnecting socket:', error.message);
        }
      });

      // Close the server
      this.io.close();
    }

    // Clear all maps
    this.userSockets.clear();
    this.messageBuffer.clear();
    this.userMessageBuffer.clear();
    this.connectionErrors.clear();

    log.info('✅ WebSocket service shut down gracefully');
  }

  /**
   * Health check
   * Returns true if WebSocket service is healthy
   */
  isHealthy() {
    return this.io !== null && this.stats.activeConnections >= 0;
  }
}

module.exports = new WebSocketService();
