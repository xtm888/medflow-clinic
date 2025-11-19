const mongoose = require('mongoose');

const commentTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['refraction', 'adaptation', 'lens_type', 'general', 'keratometry'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    required: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
commentTemplateSchema.index({ category: 1, isActive: 1, sortOrder: 1 });
commentTemplateSchema.index({ usageCount: -1 });

// Methods
commentTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Static methods
commentTemplateSchema.statics.getByCategory = async function(category) {
  return await this.find({
    category,
    isActive: true
  })
  .sort({ sortOrder: 1, usageCount: -1 })
  .select('title text category usageCount');
};

commentTemplateSchema.statics.getMostUsed = async function(limit = 10) {
  return await this.find({ isActive: true })
  .sort({ usageCount: -1 })
  .limit(limit)
  .select('title text category usageCount');
};

module.exports = mongoose.model('CommentTemplate', commentTemplateSchema);
