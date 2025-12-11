const mongoose = require('mongoose');
const GlassesOrder = require('../models/GlassesOrder');
const FrameInventory = require('../models/FrameInventory');
const { fileUtils } = require('../middleware/fileUpload');
const { buildClinicFilter, verifyClinicAccess } = require('../utils/clinicFilter');
const { isValidObjectId } = require('../utils/sanitize');

const MAX_TRYON_PHOTOS_PER_ORDER = 5;

exports.uploadTryOnPhotos = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { frameId, notes } = req.body;

    if (!isValidObjectId(orderId)) {
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({ success: false, error: 'Invalid order ID format' });
    }

    const order = await GlassesOrder.findById(orderId);
    if (!order) {
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!verifyClinicAccess(order, req)) {
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const modifiableStatuses = ['draft', 'pending_verification', 'verification_rejected'];
    if (!modifiableStatuses.includes(order.status)) {
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({ success: false, error: `Cannot add photos to order with status: ${order.status}` });
    }

    if ((order.frameTryOnPhotos?.length || 0) >= MAX_TRYON_PHOTOS_PER_ORDER) {
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({ success: false, error: `Maximum ${MAX_TRYON_PHOTOS_PER_ORDER} try-on photo sets allowed per order` });
    }

    if (!req.files?.frontPhoto?.[0] || !req.files?.sidePhoto?.[0]) {
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({ success: false, error: 'Both front photo and side photo are required' });
    }

    let frameName = 'Unknown Frame';
    if (frameId && isValidObjectId(frameId)) {
      const frame = await FrameInventory.findById(frameId).select('brand model color');
      if (frame) {
        frameName = `${frame.brand || ''} ${frame.model || ''} ${frame.color || ''}`.trim();
      }
    }

    const frontFile = req.files.frontPhoto[0];
    const sideFile = req.files.sidePhoto[0];

    const photoSet = {
      frameId: frameId && isValidObjectId(frameId) ? frameId : undefined,
      frameName,
      frontPhoto: {
        path: frontFile.path,
        url: fileUtils.getFileUrl(frontFile.path),
        filename: frontFile.filename,
        capturedAt: new Date(),
        capturedBy: req.user._id
      },
      sidePhoto: {
        path: sideFile.path,
        url: fileUtils.getFileUrl(sideFile.path),
        filename: sideFile.filename,
        capturedAt: new Date(),
        capturedBy: req.user._id
      },
      isSelectedFrame: false,
      notes: notes?.substring(0, 500) || '',
      createdAt: new Date()
    };

    if (!order.frameTryOnPhotos) {
      order.frameTryOnPhotos = [];
    }
    order.frameTryOnPhotos.push(photoSet);
    await order.save();

    const addedPhotoSet = order.frameTryOnPhotos[order.frameTryOnPhotos.length - 1];

    res.status(201).json({ success: true, message: 'Try-on photos uploaded successfully', data: addedPhotoSet });
  } catch (error) {
    if (req.files) {
      for (const fieldFiles of Object.values(req.files)) {
        for (const file of fieldFiles) {
          await fileUtils.deleteFile(file.path).catch(console.error);
        }
      }
    }
    console.error('Upload try-on photos error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload try-on photos' });
  }
};

exports.getTryOnPhotos = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, error: 'Invalid order ID format' });
    }

    const order = await GlassesOrder.findById(orderId)
      .select('frameTryOnPhotos clinic status')
      .populate('frameTryOnPhotos.frontPhoto.capturedBy', 'firstName lastName')
      .populate('frameTryOnPhotos.sidePhoto.capturedBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!verifyClinicAccess(order, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, count: order.frameTryOnPhotos?.length || 0, data: order.frameTryOnPhotos || [] });
  } catch (error) {
    console.error('Get try-on photos error:', error);
    res.status(500).json({ success: false, error: 'Failed to get try-on photos' });
  }
};

exports.deleteTryOnPhotos = async (req, res) => {
  try {
    const { orderId, photoSetId } = req.params;
    if (!isValidObjectId(orderId) || !isValidObjectId(photoSetId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }

    const order = await GlassesOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!verifyClinicAccess(order, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const modifiableStatuses = ['draft', 'pending_verification', 'verification_rejected'];
    if (!modifiableStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, error: `Cannot delete photos from order with status: ${order.status}` });
    }

    const photoSetIndex = order.frameTryOnPhotos?.findIndex(p => p._id.toString() === photoSetId);
    if (photoSetIndex === -1 || photoSetIndex === undefined) {
      return res.status(404).json({ success: false, error: 'Photo set not found' });
    }

    const photoSet = order.frameTryOnPhotos[photoSetIndex];
    if (photoSet.frontPhoto?.path) {
      await fileUtils.deleteFile(photoSet.frontPhoto.path).catch(console.error);
    }
    if (photoSet.sidePhoto?.path) {
      await fileUtils.deleteFile(photoSet.sidePhoto.path).catch(console.error);
    }

    order.frameTryOnPhotos.splice(photoSetIndex, 1);
    await order.save();

    res.json({ success: true, message: 'Try-on photos deleted successfully' });
  } catch (error) {
    console.error('Delete try-on photos error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete try-on photos' });
  }
};

exports.selectFrame = async (req, res) => {
  try {
    const { orderId, photoSetId } = req.params;
    if (!isValidObjectId(orderId) || !isValidObjectId(photoSetId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }

    const order = await GlassesOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!verifyClinicAccess(order, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const photoSet = order.frameTryOnPhotos?.find(p => p._id.toString() === photoSetId);
    if (!photoSet) {
      return res.status(404).json({ success: false, error: 'Photo set not found' });
    }

    order.frameTryOnPhotos.forEach(p => {
      p.isSelectedFrame = p._id.toString() === photoSetId;
    });

    await order.save();

    res.json({ success: true, message: 'Frame selected successfully', data: { selectedFrameId: photoSet.frameId, selectedFrameName: photoSet.frameName } });
  } catch (error) {
    console.error('Select frame error:', error);
    res.status(500).json({ success: false, error: 'Failed to select frame' });
  }
};
