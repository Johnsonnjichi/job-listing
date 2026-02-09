const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend files

// Mock Database
const getJobs = () => {
    const data = fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8');
    return JSON.parse(data);
};

// 1. Authentication - POST /auth/login
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    // Simulate static credentials
    if (email === 'candidate@test.com' && password === 'interview2024') {
        res.status(200).json({
            token: "Bearer interview-token-2024",
            message: "Login successful"
        });
    } else {
        res.status(401).json({
            error: "Invalid credentials"
        });
    }
});

// Middleware to check auth token for /jobs routes
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer interview-token-2024') {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
};

// 2. List Jobs - GET /jobs
app.get('/jobs', authenticate, (req, res) => {
    let { page = 1, limit = 10, search = '' } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    
    let jobs = getJobs();

    // Search logic (title or company)
    if (search) {
        const lowerSearch = search.toLowerCase();
        jobs = jobs.filter(job => 
            job.title.toLowerCase().includes(lowerSearch) || 
            job.company.toLowerCase().includes(lowerSearch)
        );
    }

    // Pagination logic
    const totalJobs = jobs.length;
    const totalPages = Math.ceil(totalJobs / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedJobs = jobs.slice(start, end);

    res.json({
        jobs: paginatedJobs,
        pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalJobs: totalJobs,
            limit: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    });
});

// 3. Job Details - GET /jobs/:id
app.get('/jobs/:id', authenticate, (req, res) => {
    const jobId = parseInt(req.params.id);
    const jobs = getJobs();
    const job = jobs.find(j => j.id === jobId);

    if (job) {
        res.json(job);
    } else {
        res.status(404).json({ error: "Job not found" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
