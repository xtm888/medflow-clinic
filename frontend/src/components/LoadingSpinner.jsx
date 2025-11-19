import PropTypes from 'prop-types';

export default function LoadingSpinner({ message = 'Chargement...' }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="relative">
        {/* Spinner */}
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 bg-blue-600 rounded-full"></div>
        </div>
      </div>

      {/* Loading message */}
      <p className="mt-6 text-gray-600 font-medium animate-pulse">{message}</p>

      {/* MedFlow branding */}
      <p className="mt-4 text-gray-400 text-sm">MedFlow</p>
    </div>
  );
}

LoadingSpinner.propTypes = {
  message: PropTypes.string
};
