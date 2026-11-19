// ScamShield AI frontend interactions

// Sidebar navigation
const navLinks = document.querySelectorAll('.nav');
const pages = document.querySelectorAll('.page');
function showPage(pageId) {
    pages.forEach(page => page.classList.toggle('active', page.id === pageId));
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
}
navLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    showPage(link.dataset.page);
    history.replaceState(null, '', '#' + link.dataset.page);
}));

// Theme preference
const themeButton = document.getElementById('theme-toggle');
function applyTheme(theme) {
    document.body.classList.toggle('light-theme', theme === 'light');
    if (themeButton) themeButton.textContent = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
}
const savedTheme = localStorage.getItem('scamshield-theme') || 'dark';
applyTheme(savedTheme);
if (themeButton) themeButton.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    localStorage.setItem('scamshield-theme', nextTheme);
    applyTheme(nextTheme);
});

// Phone number checker
const phoneForm = document.getElementById('phone-form');
if (phoneForm) phoneForm.addEventListener('submit', async event => {
    event.preventDefault();
    const phone = document.getElementById('phone').value.trim();
    const result = document.getElementById('phone-result');
    if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
        result.textContent = 'Please enter a valid-looking phone number.';
        return;
    }
    result.textContent = 'Checking community reports...';
    try {
        const response = await fetch('/api/phones/' + encodeURIComponent(phone));
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Phone lookup failed.');
        result.replaceChildren();
        const message = document.createElement('p');
        message.textContent = data.message;
        result.appendChild(message);
        const count = document.createElement('p');
        count.textContent = 'Community reports found: ' + data.report_count;
        result.appendChild(count);
        (data.reports || []).forEach(report => {
            const card = document.createElement('div'); card.className = 'phone-report';
            const category = document.createElement('strong'); category.textContent = report.category;
            const details = document.createElement('p'); details.textContent = report.details;
            const date = document.createElement('small'); date.textContent = 'Submitted: ' + report.created_at;
            card.append(category, details, date); result.appendChild(card);
        });
    } catch (error) { result.textContent = error.message || 'Could not check the number. Please check that Flask is running.'; }
});

// URL scanner
const urlForm = document.getElementById('url-form');
if (urlForm) urlForm.addEventListener('submit', async event => {
    event.preventDefault();
    const url = document.getElementById('url-input').value.trim();
    const result = document.getElementById('url-result');
    if (!url) { result.textContent = 'Please enter a URL.'; return; }
    result.textContent = 'Scanning URL...';
    try {
        const response = await fetch('/api/scan-url', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Scanning failed.');
        result.textContent = 'Prediction: ' + data.prediction + ' | Model confidence: ' + data.confidence + '%';
        loadDashboardStats(); loadRecentActivity();
    } catch (error) { result.textContent = error.message || 'Unable to connect to the server.'; }
});

// Submit phone report
const reportForm = document.getElementById('report-form');
if (reportForm) reportForm.addEventListener('submit', async event => {
    event.preventDefault();
    const phone = document.getElementById('report-phone').value.trim();
    const category = document.getElementById('scam-category').value;
    const details = document.getElementById('report-details').value.trim();
    const result = document.getElementById('report-result');
    if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) { result.textContent = 'Please enter a valid-looking phone number.'; return; }
    if (!category || details.length < 20) { result.textContent = 'Select a category and provide at least 20 characters of detail.'; return; }
    result.textContent = 'Submitting report...';
    try {
        const response = await fetch('/api/reports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({phone, category, details}) });
        const data = await response.json(); result.textContent = data.message || data.error || 'Request completed.';
        if (response.ok) { reportForm.reset(); loadCommunityReports(); loadDashboardStats(); loadRecentActivity(); }
    } catch (error) { result.textContent = 'Could not connect to Flask. Check that the server is running.'; }
});

// Submit URL report
const urlReportForm = document.getElementById('url-report-form');
if (urlReportForm) urlReportForm.addEventListener('submit', async event => {
    event.preventDefault();
    const url = document.getElementById('report-url').value.trim();
    const category = document.getElementById('url-scam-category').value;
    const details = document.getElementById('url-report-details').value.trim();
    const result = document.getElementById('url-report-result');
    if (!url || !category || details.length < 20) { result.textContent = 'Enter a URL, select a category and provide at least 20 characters of detail.'; return; }
    result.textContent = 'Submitting URL report...';
    try {
        const response = await fetch('/api/url-reports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url, category, details}) });
        const data = await response.json(); result.textContent = data.message || data.error || 'Request completed.';
        if (response.ok) { urlReportForm.reset(); loadCommunityReports(); loadDashboardStats(); loadRecentActivity(); }
    } catch (error) { result.textContent = 'Could not connect to Flask. Check that the server is running.'; }
});

// Community reports: phone and URL reports
async function loadCommunityReports() {
    const container = document.getElementById('community-report-list');
    if (!container) return;
    container.textContent = 'Loading reports...';
    try {
        const [phoneResponse, urlResponse] = await Promise.all([fetch('/api/reports'), fetch('/api/url-reports')]);
        if (!phoneResponse.ok || !urlResponse.ok) throw new Error('Failed to load reports.');
        const [phoneReports, urlReports] = await Promise.all([phoneResponse.json(), urlResponse.json()]);
        const rows = [
            ...phoneReports.map(r => ({type:'Phone', item:r.phone, category:r.category, details:r.details, date:r.created_at})),
            ...urlReports.map(r => ({type:'URL', item:r.url, category:r.category, details:r.details, date:r.created_at}))
        ].sort((a,b) => String(b.date).localeCompare(String(a.date)));
        if (!rows.length) { container.textContent = 'No community reports yet.'; return; }
        const table = document.createElement('table');
        const head = table.insertRow();
        ['Type','Phone / URL','Category','Details','Date Submitted'].forEach(label => { const th=document.createElement('th'); th.textContent=label; head.appendChild(th); });
        rows.forEach(report => {
            const row = table.insertRow();
            [report.type, report.item, report.category, report.details, report.date].forEach(value => { const cell=row.insertCell(); cell.textContent=value || ''; });
        });
        container.replaceChildren(table);
    } catch (error) { container.textContent = 'Unable to load reports. Check that the Flask server is running.'; console.error(error); }
}

// Dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/stats'); if (!response.ok) throw new Error('Could not load statistics');
        const stats = await response.json();
        const values = {
            'phone-report-count':stats.phone_reports, 'phone-check-count':stats.phone_checks,
            'url-scan-count':stats.url_scans, 'url-report-count':stats.url_reports,
            'top-phone-number':stats.top_phone, 'top-phone-count':stats.top_phone_count + ' community reports',
            'top-reported-url':stats.top_url, 'top-url-count':stats.top_url_count + ' community reports'
        };
        Object.entries(values).forEach(([id,value]) => { const el=document.getElementById(id); if(el) el.textContent=value; });
    } catch (error) { console.error('Dashboard statistics error:', error); }
}

// Recent activity
async function loadRecentActivity() {
    const container = document.getElementById('recent-activity'); if (!container) return;
    try {
        const response = await fetch('/api/recent-activity'); if (!response.ok) throw new Error('Unable to load recent activity');
        const activities = await response.json(); container.replaceChildren();
        if (!activities.length) { container.textContent='No recent activity available.'; return; }
        activities.forEach(activity => {
            const card=document.createElement('div'); card.className='phone-report';
            const heading=document.createElement('strong'); heading.textContent=activity.activity_type;
            const item=document.createElement('p'); item.textContent=activity.item;
            const date=document.createElement('small'); date.textContent='Date: ' + activity.activity_date;
            card.append(heading,item,date); container.appendChild(card);
        });
    } catch (error) { container.textContent='Unable to load recent activity.'; console.error(error); }
}

// Load initial data and respect a valid page hash
loadCommunityReports();
loadDashboardStats();
loadRecentActivity();
const initialPage = location.hash.slice(1);
if (initialPage && document.getElementById(initialPage)?.classList.contains('page')) showPage(initialPage);
