import { useEffect, useState, useCallback, useRef } from 'react';
import websocketService from '../services/websocketService';
import { useAuth } from './useRedux';

// Main WebSocket hook
export const useWebSocket = () => {
  const { token, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(websocketService.isConnected());

  useEffect(() => {
    const handleConnected = () => setConnected(true);
    const handleDisconnected = () => setConnected(false);

    const unsubscribeConnected = websocketService.on('connected', handleConnected);
    const unsubscribeDisconnected = websocketService.on('disconnected', handleDisconnected);

    // Connect if authenticated but not connected
    if (isAuthenticated && token && !websocketService.isConnected()) {
      websocketService.connect(token);
    }

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, [isAuthenticated, token]);

  return {
    connected,
    socket: websocketService.getSocket(),
    send: websocketService.send.bind(websocketService),
    joinRoom: websocketService.joinRoom.bind(websocketService),
    leaveRoom: websocketService.leaveRoom.bind(websocketService),
    service: websocketService,
  };
};

// Hook for listening to specific WebSocket events
export const useWebSocketEvent = (eventName, handler, deps = []) => {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventHandler = (data) => savedHandler.current(data);
    const unsubscribe = websocketService.on(eventName, eventHandler);

    return () => {
      unsubscribe();
    };
  }, [eventName, ...deps]);
};

// Hook for real-time notifications
export const useRealtimeNotifications = (onNotification) => {
  useWebSocketEvent('notification', onNotification);
};

// Hook for queue updates
export const useQueueUpdates = (onQueueUpdate) => {
  const [queueData, setQueueData] = useState(null);

  useWebSocketEvent('queue_update', (data) => {
    setQueueData(data);
    if (onQueueUpdate) {
      onQueueUpdate(data);
    }
  });

  return queueData;
};

// Hook for appointment updates
export const useAppointmentUpdates = (appointmentId) => {
  const [appointmentData, setAppointmentData] = useState(null);

  useWebSocketEvent('appointment_update', (data) => {
    if (!appointmentId || data.appointmentId === appointmentId) {
      setAppointmentData(data);
    }
  });

  return appointmentData;
};

// Hook for patient updates
export const usePatientUpdates = (patientId) => {
  const [patientData, setPatientData] = useState(null);

  useWebSocketEvent('patient_update', (data) => {
    if (!patientId || data.patientId === patientId) {
      setPatientData(data);
    }
  });

  return patientData;
};

// Hook for visit updates
export const useVisitUpdates = (visitId) => {
  const [visitData, setVisitData] = useState(null);

  useWebSocketEvent('visit_update', (data) => {
    if (!visitId || data.visitId === visitId) {
      setVisitData(data);
    }
  });

  return visitData;
};

// Hook for private messages
export const usePrivateMessages = (onMessage) => {
  const [messages, setMessages] = useState([]);

  useWebSocketEvent('message', (data) => {
    setMessages((prev) => [...prev, data]);
    if (onMessage) {
      onMessage(data);
    }
  });

  const sendMessage = useCallback((recipientId, message) => {
    websocketService.sendMessage(recipientId, message);
  }, []);

  return { messages, sendMessage };
};

// Hook for emergency alerts
export const useEmergencyAlerts = (onEmergency) => {
  const [alerts, setAlerts] = useState([]);

  useWebSocketEvent('emergency_alert', (data) => {
    setAlerts((prev) => [...prev, data]);
    if (onEmergency) {
      onEmergency(data);
    }
  });

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return { alerts, clearAlerts };
};

// Hook for lab results notifications
export const useLabResults = (patientId) => {
  const [results, setResults] = useState([]);

  useWebSocketEvent('lab_results', (data) => {
    if (!patientId || data.patientId === patientId) {
      setResults((prev) => [...prev, data]);
    }
  });

  return results;
};

// Hook for prescription ready notifications
export const usePrescriptionReady = (patientId) => {
  const [prescriptions, setPrescriptions] = useState([]);

  useWebSocketEvent('prescription_ready', (data) => {
    if (!patientId || data.patientId === patientId) {
      setPrescriptions((prev) => [...prev, data]);
    }
  });

  return prescriptions;
};

// Hook for billing updates
export const useBillingUpdates = (patientId) => {
  const [billingData, setBillingData] = useState(null);

  useWebSocketEvent('billing_update', (data) => {
    if (!patientId || data.patientId === patientId) {
      setBillingData(data);
    }
  });

  return billingData;
};

// Hook for room management
export const useRoom = (roomName) => {
  const { joinRoom, leaveRoom } = useWebSocket();

  useEffect(() => {
    if (roomName) {
      joinRoom(roomName);
      return () => {
        leaveRoom(roomName);
      };
    }
  }, [roomName, joinRoom, leaveRoom]);
};

// Hook for broadcasting to roles
export const useBroadcastToRole = () => {
  const broadcastToRole = useCallback((role, event, data) => {
    websocketService.broadcastToRole(role, event, data);
  }, []);

  return broadcastToRole;
};

// Hook for assistance requests
export const useAssistanceRequest = () => {
  const [requests, setRequests] = useState([]);

  useWebSocketEvent('assistance_request', (data) => {
    setRequests((prev) => [...prev, data]);
  });

  const requestAssistance = useCallback((location, priority) => {
    websocketService.requestAssistance(location, priority);
  }, []);

  const clearRequest = useCallback((requestId) => {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  return { requests, requestAssistance, clearRequest };
};

// Export all hooks
export default {
  useWebSocket,
  useWebSocketEvent,
  useRealtimeNotifications,
  useQueueUpdates,
  useAppointmentUpdates,
  usePatientUpdates,
  useVisitUpdates,
  usePrivateMessages,
  useEmergencyAlerts,
  useLabResults,
  usePrescriptionReady,
  useBillingUpdates,
  useRoom,
  useBroadcastToRole,
  useAssistanceRequest,
};