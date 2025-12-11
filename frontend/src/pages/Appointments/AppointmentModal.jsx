import { memo } from 'react';
import PropTypes from 'prop-types';
import AppointmentBookingForm from '../../components/AppointmentBookingForm';

const AppointmentModal = memo(function AppointmentModal({
  isOpen,
  onClose,
  onSubmit,
  providers,
  initialData
}) {
  return (
    <AppointmentBookingForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      mode="staff"
      providers={providers}
      initialData={initialData}
    />
  );
});

AppointmentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  providers: PropTypes.array.isRequired,
  initialData: PropTypes.object
};

export default AppointmentModal;
