// backend/server.js
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import mongoose from 'mongoose';
import MedicalRecord from './models/MedicalRecord.js';
import dotenv from 'dotenv';
dotenv.config();

// --- DATABASE CONNECTION ---

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({origin:'*'}));
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`)
});

// Added fileFilter for PDF and Image support
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
        }
    }
});

// --- ROUTES ---

// 1. Upload & Process Pipeline (Now with DB Storage)
app.post('/api/upload', upload.single('document'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded." });

    // Hardcoding a mock userId for now. In Phase 5, this will come from frontend auth.
    const mockUserId = req.body.userId || "patient_123";
    const filePath = req.file.path;
    const pythonScriptPath = path.join(__dirname, 'interpreter.py');

    // Inject the Gemini API Key into the child process environment variables
    const pythonEnv = { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY }; // <-- ADD YOUR KEY HERE
    
    const pythonProcess = spawn('python', [pythonScriptPath, filePath], { env: pythonEnv });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderrData += data.toString(); });

    pythonProcess.on('close', async (code) => {
        // Always clean up local file
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        let parsedOutput;
        try {
            parsedOutput = stdoutData ? JSON.parse(stdoutData.trim()) : null;
        } catch (e) {
            parsedOutput = null;
        }

        if (code !== 0 || (parsedOutput && parsedOutput.status === "error")) {
            const actualError = parsedOutput ? parsedOutput.error_message : stderrData.trim();
            console.error("❌ Python Engine Error:", actualError);
            return res.status(500).json({
                success: false,
                error: "Pipeline failed.",
                details: actualError
            });
        }

        try {
            // Save structured data to MongoDB
            const newRecord = new MedicalRecord({
                userId: mockUserId,
                extractedCharacterCount: parsedOutput.extracted_character_count,
                biomarkers: parsedOutput.analysis.biomarkers,
                explanation: parsedOutput.analysis.explanation,
                questionsForDoctor: parsedOutput.analysis.questions_for_doctor
            });

            await newRecord.save();

            return res.status(200).json({
                success: true,
                message: "Document processed and permanently saved to database.",
                data: newRecord
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: "Database error.", details: error.message });
        }
    });
});

// 2. Fetch Historical Trends Route
app.get('/api/records/trends/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Fetch all records for the user, sorted oldest to newest (1)
        const records = await MedicalRecord.find({ userId }).sort({ recordDate: 1 });

        res.status(200).json({
            success: true,
            count: records.length,
            timeline: records
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch timeline." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`[🚀 Orchestrator] Running on http://localhost:${PORT}`));