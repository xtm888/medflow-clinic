import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Clock, Users, MapPin, Volume2, Bell, AlertCircle } from 'lucide-react';

/**
 * Queue Display Board Component
 * Full-screen display for TV screens and digital signage in waiting areas
 * Shows current queue status, room assignments, and patient calls
 *
 * Features:
 * - Real-time WebSocket updates
 * - Audio announcements
 * - Multi-language support (French, English, Swahili, Lingala)
 * - Auto-refresh fallback
 * - Accessibility considerations
 */
export default function QueueDisplayBoard() {
  const [displayData, setDisplayData] = useState([]);
  const [queueData, setQueueData] = useState({ waiting: [], inProgress: [] });
  const [currentCall, setCurrentCall] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [language, setLanguage] = useState('fr');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Translations
  const translations = {
    fr: {
      title: "File d'Attente",
      waiting: "En attente",
      inProgress: "En consultation",
      room: "Salle",
      patient: "Patient",
      queueNumber: "N°",
      noWaiting: "Aucun patient en attente",
      noInProgress: "Aucune consultation en cours",
      calling: "Appel:",
      pleaseGo: "veuillez vous présenter en salle",
      avgWait: "Temps d'attente moyen"
    },
    en: {
      title: "Waiting Queue",
      waiting: "Waiting",
      inProgress: "In Consultation",
      room: "Room",
      patient: "Patient",
      queueNumber: "#",
      noWaiting: "No patients waiting",
      noInProgress: "No consultations in progress",
      calling: "Calling:",
      pleaseGo: "please proceed to room",
      avgWait: "Average wait time"
    },
    sw: {
      title: "Foleni ya Kusubiri",
      waiting: "Wanasubiri",
      inProgress: "Kwenye Mashauriano",
      room: "Chumba",
      patient: "Mgonjwa",
      queueNumber: "Nambari",
      noWaiting: "Hakuna wagonjwa wanasubiri",
      noInProgress: "Hakuna mashauriano yanayoendelea",
      calling: "Kuita:",
      pleaseGo: "tafadhali nenda kwenye chumba",
      avgWait: "Muda wa wastani wa kusubiri"
    },
    ln: {
      title: "Molongo ya Kozela",
      waiting: "Bazali kozela",
      inProgress: "Bazali na lisolo",
      room: "Shambre",
      patient: "Malade",
      queueNumber: "Numelo",
      noWaiting: "Moto moko te azali kozela",
      noInProgress: "Lisolo moko te ezali kokende",
      calling: "Kobenga:",
      pleaseGo: "kende na shambre",
      avgWait: "Ntango ya kozela"
    }
  };

  const t = translations[language];

  // Fetch initial display data
  const fetchDisplayData = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5001/api`;

      // Fetch room display data (public endpoint)
      const roomResponse = await fetch(`${API_BASE}/rooms/display-board`);
      if (roomResponse.ok) {
        const roomData = await roomResponse.json();
        setDisplayData(roomData.data || []);
      }

      // Fetch queue display data (public endpoint)
      const queueResponse = await fetch(`${API_BASE}/queue/display-board`);
      if (queueResponse.ok) {
        const qData = await queueResponse.json();
        setQueueData(qData.data || { waiting: [], inProgress: [] });
      }
    } catch (error) {
      console.error('Failed to fetch display data:', error);
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    fetchDisplayData();

    // Connect to WebSocket on backend server
    const WS_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || `${window.location.protocol}//${window.location.hostname}:5001`;
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Display Board WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Display Board WebSocket disconnected');
      setIsConnected(false);
    });

    // Listen for queue updates (global event, no room subscription needed)
    socket.on('queue_update', (data) => {
      console.log('Display board update:', data.type);
      fetchDisplayData();

      // Handle patient calls with announcements
      if (data.type === 'patient_called' && data.announcement) {
        setCurrentCall({
          patientName: data.announcement.patientName,
          roomNumber: data.announcement.roomNumber,
          message: data.announcement.message,
          timestamp: new Date()
        });

        // Play audio announcement
        if (audioEnabled && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(data.announcement.audioText || data.announcement.message);
          utterance.lang = language === 'fr' ? 'fr-FR' : language === 'en' ? 'en-US' : 'fr-FR';
          utterance.rate = 0.85;
          utterance.volume = 1;
          window.speechSynthesis.speak(utterance);
        }

        // Clear call after 15 seconds
        setTimeout(() => setCurrentCall(null), 15000);
      }
    });

    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Fallback polling every 30 seconds
    const pollInterval = setInterval(fetchDisplayData, 30000);

    return () => {
      socket.disconnect();
      clearInterval(clockInterval);
      clearInterval(pollInterval);
    };
  }, [audioEnabled, language]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'cleaning': return 'bg-yellow-500';
      case 'maintenance': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center">
            <Users className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">{t.title}</h1>
            <p className="text-blue-200 text-lg">Centre Médical MedFlow</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-blue-700 border border-blue-500 rounded-lg px-4 py-2 text-white"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="sw">Kiswahili</option>
            <option value="ln">Lingala</option>
          </select>

          {/* Audio Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-3 rounded-lg ${audioEnabled ? 'bg-green-600' : 'bg-gray-600'}`}
            title={audioEnabled ? 'Audio activé' : 'Audio désactivé'}
          >
            <Volume2 className="h-6 w-6" />
          </button>

          {/* Connection Status */}
          <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />

          {/* Clock */}
          <div className="text-right">
            <div className="text-4xl font-mono font-bold">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-blue-200">
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
      </div>

      {/* Current Call Banner */}
      {currentCall && (
        <div className="mb-8 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-black rounded-2xl p-6 animate-pulse shadow-2xl">
          <div className="flex items-center justify-center space-x-6">
            <Bell className="h-16 w-16 animate-bounce" />
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">{t.calling}</div>
              <div className="text-5xl font-black">{currentCall.patientName}</div>
              <div className="text-3xl mt-2">
                {t.pleaseGo} <span className="font-black text-4xl">{currentCall.roomNumber}</span>
              </div>
            </div>
            <Bell className="h-16 w-16 animate-bounce" />
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Waiting Queue - Takes 2 columns */}
        <div className="col-span-2 bg-blue-800/50 rounded-2xl p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center">
              <Clock className="h-8 w-8 mr-3 text-blue-300" />
              {t.waiting}
            </h2>
            <span className="text-4xl font-bold text-yellow-400">
              {queueData.waiting?.length || 0}
            </span>
          </div>

          {queueData.waiting?.length === 0 ? (
            <div className="text-center py-12 text-blue-300">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">{t.noWaiting}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {queueData.waiting?.slice(0, 10).map((patient, index) => (
                <div
                  key={patient.appointmentId || index}
                  className={`p-4 rounded-xl ${
                    index === 0
                      ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                      : 'bg-blue-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${
                        index === 0 ? 'bg-white text-green-600' : 'bg-blue-600'
                      }`}>
                        #{patient.queueNumber}
                      </div>
                      <div>
                        <div className="font-semibold text-lg">
                          {patient.name || patient.patientName || `${patient.patient?.firstName || ''} ${patient.patient?.lastName || ''}`}
                        </div>
                        <div className="text-sm opacity-75">
                          {patient.estimatedWaitTime || 0} min
                        </div>
                      </div>
                    </div>
                    {index === 0 && (
                      <div className="text-right">
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                          Suivant
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {queueData.waiting?.length > 10 && (
            <div className="text-center mt-4 text-blue-300">
              +{queueData.waiting.length - 10} {t.waiting.toLowerCase()}...
            </div>
          )}
        </div>

        {/* Rooms Status - Right column */}
        <div className="bg-blue-800/50 rounded-2xl p-6 backdrop-blur">
          <h2 className="text-2xl font-bold flex items-center mb-6">
            <MapPin className="h-8 w-8 mr-3 text-blue-300" />
            {t.room}s
          </h2>

          <div className="space-y-4">
            {displayData.length === 0 ? (
              <div className="text-center py-8 text-blue-300">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune salle configurée</p>
              </div>
            ) : (
              displayData.map((room, index) => (
                <div
                  key={room.roomNumber || index}
                  className={`p-4 rounded-xl border-l-4 ${
                    room.status === 'occupied'
                      ? 'bg-red-900/50 border-red-500'
                      : room.status === 'available'
                        ? 'bg-green-900/50 border-green-500'
                        : 'bg-gray-800/50 border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">{room.name || room.roomNumber}</div>
                      <div className="text-sm opacity-75">{room.roomNumber}</div>
                    </div>
                    <div className="text-right">
                      {room.status === 'occupied' && room.queueNumber && (
                        <div className="text-2xl font-bold text-yellow-400">
                          #{room.queueNumber}
                        </div>
                      )}
                      {room.status === 'occupied' && room.patientName && (
                        <div className="text-sm opacity-75">
                          {room.patientName}
                        </div>
                      )}
                      {room.status === 'available' && (
                        <span className="px-3 py-1 bg-green-500/30 text-green-300 rounded-full text-sm">
                          Disponible
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* In Progress Strip at Bottom */}
      {queueData.inProgress?.length > 0 && (
        <div className="mt-6 bg-green-800/50 rounded-2xl p-4 backdrop-blur">
          <div className="flex items-center space-x-6 overflow-x-auto">
            <span className="text-lg font-semibold whitespace-nowrap text-green-300">
              {t.inProgress}:
            </span>
            {queueData.inProgress.map((patient, index) => (
              <div
                key={patient.appointmentId || index}
                className="flex items-center space-x-3 bg-green-700/50 rounded-lg px-4 py-2 whitespace-nowrap"
              >
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold">
                  #{patient.queueNumber}
                </div>
                <div>
                  <div className="font-medium">
                    {patient.name || patient.patientName || `${patient.patient?.firstName || ''} ${patient.patient?.lastName || ''}`}
                  </div>
                  {(patient.room || patient.roomNumber) && (
                    <div className="text-xs text-green-300">{t.room} {patient.room || patient.roomNumber}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-blue-300 text-sm">
        <p>Merci de patienter. Vous serez appelé dans l'ordre de priorité.</p>
      </div>
    </div>
  );
}
