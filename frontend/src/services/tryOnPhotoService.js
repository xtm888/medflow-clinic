import api from './apiConfig';

const tryOnPhotoService = {
  uploadPhotos: async (orderId, frontPhoto, sidePhoto, frameId = null, notes = '') => {
    const formData = new FormData();
    formData.append('frontPhoto', frontPhoto);
    formData.append('sidePhoto', sidePhoto);
    if (frameId) formData.append('frameId', frameId);
    if (notes) formData.append('notes', notes);

    const response = await api.post(
      `/optical-shop/orders/${orderId}/try-on-photos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  getPhotos: async (orderId) => {
    const response = await api.get(`/optical-shop/orders/${orderId}/try-on-photos`);
    return response.data;
  },

  deletePhotos: async (orderId, photoSetId) => {
    const response = await api.delete(`/optical-shop/orders/${orderId}/try-on-photos/${photoSetId}`);
    return response.data;
  },

  selectFrame: async (orderId, photoSetId) => {
    const response = await api.put(`/optical-shop/orders/${orderId}/try-on-photos/${photoSetId}/select`);
    return response.data;
  }
};

export default tryOnPhotoService;
