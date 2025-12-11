import { memo, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Search, List, Grid3X3, Calendar, CalendarDays } from 'lucide-react';

const AppointmentFilters = memo(forwardRef(function AppointmentFilters(
  { viewMode, onViewModeChange, searchTerm, onSearchChange, filterStatus, onFilterStatusChange },
  searchInputRef
) {
  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Vue Liste"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Liste</span>
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-3 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              viewMode === 'week'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Vue Semaine"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Semaine</span>
          </button>
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-3 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              viewMode === 'month'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Vue Mois"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Mois</span>
          </button>
          <button
            onClick={() => onViewModeChange('agenda')}
            className={`px-3 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              viewMode === 'agenda'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Vue Agenda"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un patient..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input pl-10"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="input w-full md:w-48"
          >
            <option value="all">Tous les statuts</option>
            <option value="confirmed">Confirmés</option>
            <option value="pending">En attente</option>
            <option value="completed">Terminés</option>
            <option value="cancelled">Annulés</option>
            <option value="no_show">Absences</option>
          </select>
        </div>
      </div>
    </div>
  );
}));

AppointmentFilters.propTypes = {
  viewMode: PropTypes.oneOf(['list', 'week', 'month', 'agenda']).isRequired,
  onViewModeChange: PropTypes.func.isRequired,
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  filterStatus: PropTypes.string.isRequired,
  onFilterStatusChange: PropTypes.func.isRequired
};

export default AppointmentFilters;
