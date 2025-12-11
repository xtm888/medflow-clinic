/**
 * Queue utility functions
 */

export const getPriorityColor = (priority) => {
  switch (priority) {
    case 'vip':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'pregnant':
      return 'bg-pink-100 text-pink-800 border-pink-300';
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'elderly':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'emergency':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const getWaitTimeColor = (minutes) => {
  if (minutes < 15) return 'text-green-600';
  if (minutes < 30) return 'text-orange-600';
  return 'text-red-600 animate-pulse';
};

export const getWaitTimeBarColor = (minutes) => {
  if (minutes < 15) return 'border-l-8 border-green-500 bg-green-50/30';
  if (minutes < 30) return 'border-l-8 border-orange-500 bg-orange-50/30';
  return 'border-l-8 border-red-500 bg-red-50/30 animate-pulse';
};

export const getPriorityLabel = (priority) => {
  switch (priority) {
    case 'vip':
      return 'VIP';
    case 'pregnant':
      return 'Enceinte';
    case 'urgent':
      return 'Urgent';
    case 'elderly':
      return 'Âgé';
    case 'emergency':
      return 'Urgence';
    case 'high':
      return 'Priorité';
    default:
      return priority;
  }
};

export const priorityOrder = {
  'emergency': 0,
  'urgent': 1,
  'vip': 2,
  'pregnant': 3,
  'elderly': 4,
  'high': 5,
  'normal': 6
};

export const sortPatients = (patients, sortBy) => {
  const sorted = [...patients];
  const getTime = (dateStr) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  };

  switch (sortBy) {
    case 'priority':
      return sorted.sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
        if (priorityDiff !== 0) return priorityDiff;
        return getTime(a.checkInTime) - getTime(b.checkInTime);
      });
    case 'arrival':
      return sorted.sort((a, b) => getTime(a.checkInTime) - getTime(b.checkInTime));
    case 'waitTime':
      return sorted.sort((a, b) => (b.estimatedWaitTime || 0) - (a.estimatedWaitTime || 0));
    default:
      return sorted;
  }
};

export const calculateWaitTime = (checkInTime, currentTime) => {
  if (!checkInTime) return 0;
  const checkIn = new Date(checkInTime).getTime();
  if (isNaN(checkIn)) return 0;
  const diffMs = currentTime - checkIn;
  return Math.max(0, Math.floor(diffMs / 60000));
};
