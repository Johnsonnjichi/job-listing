// Utility to help with filter when searching
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Config - Toggle this to use the real API if needed
const API_BASE_URL = 'https://interview.techliana.com';

// State
const state = {
    token: localStorage.getItem('auth_token'),
    currentPage: 1,
    currentSearch: '',
    limit: 10
};

// DOM Elements
const views = {
    login: document.getElementById('login-view'),
    jobs: document.getElementById('jobs-view'),
    details: document.getElementById('details-view')
};

const mainLayout = document.getElementById('main-layout');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Search
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    
    // Debounced Search on Input
    const debouncedSearch = debounce(() => handleSearch(), 300);
    document.getElementById('search-input').addEventListener('input', debouncedSearch);

    // Pagination
    document.getElementById('prev-btn').addEventListener('click', () => changePage(-1));
    document.getElementById('next-btn').addEventListener('click', () => changePage(1));

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => switchView('jobs'));
}

function checkAuth() {
    if (state.token) {
        showApp();
    } else {
        showLogin();
    }
}

function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLogin() {
    mainLayout.classList.add('hidden');
    switchView('login');
}

function showApp() {
    views.login.classList.add('hidden');
    mainLayout.classList.remove('hidden');
    switchView('jobs');
    fetchJobs();
}

// Auth Functions
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button');

    // Loading State
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Signing in...';
    submitBtn.disabled = true;
    errorEl.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            state.token = data.token;
            localStorage.setItem('auth_token', data.token);
            showToast('Login successful', 'success');
            showApp();
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

function handleLogout() {
    state.token = null;
    localStorage.removeItem('auth_token');
    showLogin();
    showToast('Logged out successfully');
}

// Jobs Functions
async function fetchJobs() {
    const container = document.getElementById('jobs-container');
    const loader = document.getElementById('loading-indicator');
    
    container.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const params = new URLSearchParams({
            page: state.currentPage,
            limit: state.limit
        });

        if (state.currentSearch) {
            params.append('search', state.currentSearch);
        }

        const response = await fetch(`${API_BASE_URL}/jobs?${params}`, {
            headers: { 'Authorization': state.token }
        });

        if (response.status === 401) {
            handleLogout();
            return;
        }

        const data = await response.json();
        renderJobs(data.jobs);
        updatePagination(data.pagination);
    } catch (err) {
        console.error(err);
        showToast('Failed to load jobs', 'error');
    } finally {
        loader.classList.add('hidden');
    }
}

function renderJobs(jobs) {
    const container = document.getElementById('jobs-container');
    
    if (jobs.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">
                <h3>No jobs found</h3>
                <p>Try adjusting your search criteria</p>
            </div>
        `;
        return;
    }

    container.innerHTML = jobs.map(job => `
        <div class="job-card" onclick="fetchJobDetails(${job.id})">
            <div>
                <h3>${job.title}</h3>
                <p class="company">${job.company}</p>
            </div>
            <div class="job-meta">
                <span class="tag">📍 ${job.location}</span>
                <span class="tag">💰 ${job.salary}</span>
                <span class="tag">⏱️ ${job.jobType}</span>
            </div>
            <div class="job-footer">
                <span>Posted: ${new Date(job.postedDate).toLocaleDateString()}</span>
                <span style="color: var(--primary-color)">View Details &rarr;</span>
            </div>
        </div>
    `).join('');
}

function updatePagination(pagination) {
    const { currentPage, totalPages } = pagination;
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const info = document.getElementById('page-info');

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    info.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

function changePage(delta) {
    state.currentPage += delta;
    fetchJobs();
}

function handleSearch() {
    const input = document.getElementById('search-input');
    state.currentSearch = input.value.trim();
    state.currentPage = 1; // Reset to page 1 on search
    fetchJobs();
}


// Job Details Functions
async function fetchJobDetails(id) {
    const container = document.getElementById('job-details-content');
    
    // Switch view immediately to show we are navigating
    switchView('details');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading details...</p></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${id}`, {
            headers: { 'Authorization': state.token }
        });

        if (!response.ok) throw new Error('Failed to fetch job details');

        const job = await response.json();
        renderJobDetails(job);
    } catch (err) {
        showToast(err.message, 'error');
        switchView('jobs');
    }
}

function renderJobDetails(job) {
    const container = document.getElementById('job-details-content');
    
    // Convert requirements array to HTML list
    const reqList = job.requirements.map(req => `<li>${req}</li>`).join('');

    container.innerHTML = `
        <div class="details-header">
            <h1>${job.title}</h1>
            <h2 style="color: var(--accent-color); margin-bottom: 1rem;">${job.company}</h2>
            
            <div class="job-meta" style="font-size: 1rem; margin-top: 1.5rem;">
                <span class="tag" style="padding: 0.5rem 1rem;">📍 ${job.location}</span>
                <span class="tag" style="padding: 0.5rem 1rem;">💰 ${job.salary}</span>
                <span class="tag" style="padding: 0.5rem 1rem;">⏱️ ${job.jobType}</span>
                <span class="tag" style="padding: 0.5rem 1rem;">📅 Posted: ${new Date(job.postedDate).toLocaleDateString()}</span>
            </div>
        </div>

        <div class="details-section">
            <h3>Description</h3>
            <p>${job.description}</p>
        </div>

        <div class="details-section">
            <h3>Requirements</h3>
            <ul>
                ${reqList}
            </ul>
        </div>
        
        <div style="text-align: center; margin-top: 3rem;">
            <button class="btn btn-primary" onclick="showToast('Application feature coming soon!')">Apply Now</button>
        </div>
    `;
}

// Utilities
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    if (type === 'error') {
        toast.style.borderLeftColor = 'var(--error-color)';
    } else {
        toast.style.borderLeftColor = 'var(--primary-color)';
    }

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
