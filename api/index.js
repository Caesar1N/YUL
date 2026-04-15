import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { body, validationResult } from 'express-validator';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Standard Middleware
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

// Analytics Schema
const deckSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    referrer: { type: String },
    userAgent: { type: String },
    screenParams: { type: String },
    visitStart: { type: Date, default: null },
    slideDwellTimes: { type: mongoose.Schema.Types.Mixed },
    maxScrollDepth: { type: Number, default: 0 },
    sectionsVisited: [{ type: String }],
    totalDuration: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const DeckSession = mongoose.model('DeckSession', deckSessionSchema);

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

        // console.log(`📩 New Lead: ${email} from ${company}`);
        res.status(201).json({ success: true, message: 'Your request has been received. We will be in touch shortly.' });
    } catch (error) {
        console.error('Submission Error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

app.post('/api/deck-analytics', async (req, res) => {
    try {
        const payload = req.body;
        
        // Find existing session or create new
        await DeckSession.findOneAndUpdate(
            { sessionId: payload.sessionId },
            { $set: payload },
            { upsert: true, new: true }
        );
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Analytics Storage Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Start Server (Only if not running on Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

export default app;
