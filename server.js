import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { body, validationResult } from 'express-validator';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Schema Schema
const leadSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    country: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
});

const Lead = mongoose.model('Lead', leadSchema);

// API Routes
app.post('/api/leads', [
    // Sanitization & Validation
    body('name').trim().escape().notEmpty().withMessage('Name is required'),
    body('company').trim().escape().notEmpty().withMessage('Company is required'),
    body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
    body('country').trim().escape().notEmpty().withMessage('Country is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { name, company, email, country } = req.body;
        const newLead = new Lead({ name, company, email, country });
        await newLead.save();

        console.log(`📩 New Lead: ${email} from ${company}`);
        res.status(201).json({ success: true, message: 'Your request has been received. We will be in touch shortly.' });
    } catch (error) {
        console.error('Submission Error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
