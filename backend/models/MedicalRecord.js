// backend/models/MedicalRecord.js
import mongoose from 'mongoose';

// We define a sub-schema for the individual metrics.
// _id: false prevents MongoDB from generating a unique ID for every single biomarker, saving disk space.
const biomarkerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    value: { type: String, required: true },
    unit: { type: String },
    status: { type: String, enum: ['Normal', 'High', 'Low', 'Unknown'], default: 'Unknown' }
}, { _id: false });

const medicalRecordSchema = new mongoose.Schema({
    // Indexed for lightning-fast retrieval of a specific user's timeline
    userId: { type: String, required: true, index: true },
    recordDate: { type: Date, default: Date.now },
    extractedCharacterCount: { type: Number },
    biomarkers: [biomarkerSchema],
    explanation: { type: String },
    questionsForDoctor: [{ type: String }]
}, { timestamps: true });

export default mongoose.model('MedicalRecord', medicalRecordSchema);