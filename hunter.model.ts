import * as mongoose from 'mongoose';
let ObjectId = mongoose.Schema.ObjectId;

let CatalogSourceSchema = new mongoose.Schema({
  title: String,
  hunts: Array,
  created_at: { type: Date },
  updated_at: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
}, {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  });
export default mongoose.model('Hunter', CatalogSourceSchema);
