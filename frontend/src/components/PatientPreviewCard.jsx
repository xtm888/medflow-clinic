import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, Calendar, AlertTriangle, Clock,
  Eye, Edit, Plus, Droplets, Heart, Activity
} from 'lucide-react';
import { PatientPhotoAvatar } from './biometric';

// Hover delay before showing card (ms)
const HOVER_DELAY = 300;
// Delay before hiding card when mouse leaves (ms)
const HIDE_DELAY = 150;

export default function PatientPreviewCard({
  patient,
  children,
  position = 'right', // 'left', 'right', 'top', 'bottom'
  disabled = false
}) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const showTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate card position
  const updateCardPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const cardWidth = 320;
    const cardHeight = 280;
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'right':
        top = triggerRect.top;
        left = triggerRect.right + padding;
        // If card goes off right edge, show on left
        if (left + cardWidth > viewportWidth) {
          left = triggerRect.left - cardWidth - padding;
        }
        break;
      case 'left':
        top = triggerRect.top;
        left = triggerRect.left - cardWidth - padding;
        // If card goes off left edge, show on right
        if (left < 0) {
          left = triggerRect.right + padding;
        }
        break;
      case 'top':
        top = triggerRect.top - cardHeight - padding;
        left = triggerRect.left;
        // If card goes off top, show on bottom
        if (top < 0) {
          top = triggerRect.bottom + padding;
        }
        break;
      case 'bottom':
        top = triggerRect.bottom + padding;
        left = triggerRect.left;
        // If card goes off bottom, show on top
        if (top + cardHeight > viewportHeight) {
          top = triggerRect.top - cardHeight - padding;
        }
        break;
      default:
        top = triggerRect.top;
        left = triggerRect.right + padding;
    }

    // Ensure card stays within viewport
    if (left < padding) left = padding;
    if (left + cardWidth > viewportWidth - padding) left = viewportWidth - cardWidth - padding;
    if (top < padding) top = padding;
    if (top + cardHeight > viewportHeight - padding) top = viewportHeight - cardHeight - padding;

    setCardPosition({ top, left });
  };

  const handleMouseEnter = () => {
    if (disabled) return;

    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Set timeout to show card
    showTimeoutRef.current = setTimeout(() => {
      updateCardPosition();
      setIsVisible(true);
    }, HOVER_DELAY);
  };

  const handleMouseLeave = () => {
    // Clear any pending show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Set timeout to hide card (allows mouse to move to card)
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, HIDE_DELAY);
  };

  const handleCardMouseEnter = () => {
    // Clear hide timeout when mouse enters card
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    // Hide card when mouse leaves
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, HIDE_DELAY);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Update position on window resize
  useEffect(() => {
    if (isVisible) {
      const handleResize = () => updateCardPosition();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isVisible]);

  if (!patient) return children;

  const age = calculateAge(patient.dateOfBirth);
  const phone = patient.phoneNumber || patient.phone || null;
  const email = patient.email || null;
  const bloodType = patient.bloodGroup || patient.bloodType || null;
  const allergies = patient.medicalHistory?.allergies || patient.allergies || [];
  const lastVisit = patient.lastVisit || patient.lastVisitDate;
  const nextAppointment = patient.nextAppointment || patient.nextAppointmentDate;
  const insurance = patient.insurance?.provider || (typeof patient.insurance === 'string' ? patient.insurance : null);
  const hasAllergies = allergies.length > 0;
  const priority = patient.priority || patient.patientType || 'normal';
  const isVip = priority === 'vip' || patient.vip;

  return (
    <>
      {/* Trigger element */}
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>

      {/* Preview Card */}
      {isVisible && (
        <div
          ref={cardRef}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className="fixed z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-fade-in"
          style={{
            top: `${cardPosition.top}px`,
            left: `${cardPosition.left}px`,
          }}
        >
          {/* Header with gradient */}
          <div className={`px-4 py-3 ${
            isVip
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600'
              : 'bg-gradient-to-r from-blue-500 to-blue-600'
          }`}>
            <div className="flex items-center space-x-3">
              <PatientPhotoAvatar
                patient={patient}
                size="md"
                showBiometricBadge={false}
                className="border-2 border-white/30"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold truncate">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-white/80 text-sm">
                  {patient.patientId && <span className="mr-2">#{patient.patientId}</span>}
                  {age !== 'N/A' && `${age} ans`}
                </p>
              </div>
              {isVip && (
                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                  VIP
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Contact info */}
            <div className="flex items-center space-x-4 text-sm">
              {phone && (
                <div className="flex items-center text-gray-600">
                  <Phone className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  <span className="truncate">{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center text-gray-600 min-w-0">
                  <Mail className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex items-center space-x-3">
              {bloodType && (
                <div className="flex items-center px-2 py-1 bg-red-50 rounded-lg text-sm">
                  <Droplets className="h-3.5 w-3.5 mr-1 text-red-500" />
                  <span className="font-medium text-red-700">{bloodType}</span>
                </div>
              )}
              {insurance && (
                <div className="flex items-center px-2 py-1 bg-green-50 rounded-lg text-sm">
                  <Heart className="h-3.5 w-3.5 mr-1 text-green-500" />
                  <span className="font-medium text-green-700 truncate max-w-[100px]">{insurance}</span>
                </div>
              )}
            </div>

            {/* Allergies warning */}
            {hasAllergies && (
              <div className="flex items-start p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium text-orange-800">Allergies: </span>
                  <span className="text-orange-700">
                    {allergies.slice(0, 3).join(', ')}
                    {allergies.length > 3 && ` +${allergies.length - 3} autres`}
                  </span>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center">
                <Clock className="h-3.5 w-3.5 mr-1" />
                <span>Dernière visite: {formatDate(lastVisit)}</span>
              </div>
              {nextAppointment && (
                <div className="flex items-center text-blue-600">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  <span>Prochain: {formatDate(nextAppointment)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => navigate(`/patients/${patient._id || patient.id}`)}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Voir dossier
            </button>
            <button
              onClick={() => navigate(`/appointments?patientId=${patient._id || patient.id}`)}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-100 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nouveau RDV
            </button>
          </div>
        </div>
      )}
    </>
  );
}
