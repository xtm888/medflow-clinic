const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map user IDs to socket IDs
  }

  initialize(server, corsOptions) {
    this.io = socketIO(server, {
      cors: corsOptions,
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    console.log('✅ WebSocket service initialized');
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
      console.log(`User ${socket.user.firstName} ${socket.user.lastName} connected`);

      // Store user socket mapping
      this.userSockets.set(socket.userId, socket.id);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join user to their role-based room
      socket.join(`role:${socket.user.role}`);

      // Join user to department room if applicable
      if (socket.user.department) {
        socket.join(`department:${socket.user.department}`);
      }

      // Handle custom events
      socket.on('subscribe:queue', (data) => {
        socket.join('queue:updates');
      });

      socket.on('subscribe:patient', (patientId) => {
        socket.join(`patient:${patientId}`);
      });

      socket.on('subscribe:notifications', () => {
        socket.join(`notifications:${socket.userId}`);
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', () => {
        console.log(`User ${socket.user.firstName} ${socket.user.lastName} disconnected`);
        this.userSockets.delete(socket.userId);
      });
    });
  }

  // Emit queue update to all subscribed clients
  emitQueueUpdate(queueData) {
    if (this.io) {
      this.io.to('queue:updates').emit('queue:updated', queueData);
    }
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification:new', notification);
      this.io.to(`notifications:${userId}`).emit('notification:update', notification);
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
      this.io.to(`patient:${patientId}`).emit('patient:updated', updateData);
    }
  }

  // Emit appointment update
  emitAppointmentUpdate(appointmentData) {
    if (this.io) {
      this.io.emit('appointment:updated', appointmentData);
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

      // Notify patient
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('lab:results', labData);
      }

      // Notify provider
      if (providerId) {
        this.io.to(`user:${providerId}`).emit('lab:results', labData);
      }

      // Notify lab technicians
      this.io.to('role:lab_technician').emit('lab:update', labData);
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
}

module.exports = new WebSocketService();