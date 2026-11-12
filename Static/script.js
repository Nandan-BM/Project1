
/* =====================================
   1. PHONE NUMBER CHECKER
===================================== */

document.getElementById("phone-form").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const phone = document.getElementById("phone").value.trim();
        const result = document.getElementById("phone-result");

        if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
            result.textContent = "Please enter a valid-looking phone number.";
            return;
        }

        result.textContent = "Checking community reports...";

        try {
            const response = await fetch(
                "/api/phones/" + encodeURIComponent(phone)
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Phone lookup failed.");
            }

            result.replaceChildren();

            const message = document.createElement("p");
            message.textContent = data.message;
            result.appendChild(message);

            const count = document.createElement("p");
            count.textContent = "Community reports found: " + data.report_count;
            result.appendChild(count);

            data.reports.forEach(function (report) {
                const card = document.createElement("div");
                card.className = "phone-report";

                const category = document.createElement("strong");
                category.textContent = report.category;
                card.appendChild(category);

                const details = document.createElement("p");
                details.textContent = report.details;
                card.appendChild(details);

                const date = document.createElement("small");
                date.textContent = "Submitted: " + report.created_at;
                card.appendChild(date);

                result.appendChild(card);
            });
        } catch (error) {
            result.textContent =
                "Could not check the number. Please check that Flask is running.";
        }
    }
);


/* =====================================
   2. URL SCANNER
   ML MODEL NOT CONNECTED YET
===================================== */


document.getElementById("url-form").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const url = document.getElementById("url-input").value.trim();
        const result = document.getElementById("url-result");

        if (!url) {
            result.textContent = "Please enter a URL.";
            return;
        }

        result.textContent = "Scanning URL...";

        try {
            const response = await fetch("/api/scan-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();

            if (!response.ok) {
                result.textContent = data.error || "Scanning failed.";
                return;
            }

            result.textContent =
                "Prediction: " + data.prediction +
                " | Model confidence: " + data.confidence + "%";

        } catch (error) {
            result.textContent = "Unable to connect to the server.";
            console.error(error);
        }
    }
);




/* =====================================
   3. SIDEBAR PAGE NAVIGATION
===================================== */

const navLinks = document.querySelectorAll(".nav");
const pages = document.querySelectorAll(".page");

navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();

        const targetPage = link.dataset.page;

        pages.forEach(function (page) {
            page.classList.remove("active");
        });

        navLinks.forEach(function (item) {
            item.classList.remove("active");
        });

        document.getElementById(targetPage).classList.add("active");
        link.classList.add("active");
    });
});



/* =====================================
   4. SUBMIT SCAM REPORT
===================================== */

document.getElementById("report-form").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const phone = document.getElementById("report-phone").value.trim();
        const category = document.getElementById("scam-category").value;
        const details = document.getElementById("report-details").value.trim();
        const result = document.getElementById("report-result");

        if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
            result.textContent = "Please enter a valid-looking phone number.";
            return;
        }

        if (!category) {
            result.textContent = "Please select a scam category.";
            return;
        }

        if (details.length < 20) {
            result.textContent =
                "Please provide at least 20 characters of detail.";
            return;
        }

        result.textContent = "Submitting report...";

        try {
            const response = await fetch("/api/reports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    phone: phone,
                    category: category,
                    details: details
                })
            });

            const data = await response.json();
            result.textContent = data.message;

            if (response.ok) {
                document.getElementById("report-form").reset();

                // Refresh the community report table.
                loadCommunityReports();
            }
        } catch (error) {
            result.textContent =
                "Could not connect to Flask. Check that the server is running.";
        }
    }
);


/* =====================================
   5. LOAD COMMUNITY REPORTS
===================================== */

async function loadCommunityReports() {
    const container = document.getElementById("community-report-list");

    if (!container) return;

    try {
        const response = await fetch("/api/reports");

        if (!response.ok) {
            throw new Error("Failed to load reports.");
        }

        const reports = await response.json();

        if (reports.length === 0) {
            container.textContent = "No community reports yet.";
            return;
        }

        const table = document.createElement("table");
        const header = table.insertRow();

        [
            "Phone Number",
            "Category",
            "Details",
            "Date Submitted"
        ].forEach(function (heading) {
            const th = document.createElement("th");
            th.textContent = heading;
            header.appendChild(th);
        });

        reports.forEach(function (report) {
            const row = table.insertRow();

            [
                report.phone,
                report.category,
                report.details,
                report.created_at
            ].forEach(function (value) {
                const cell = row.insertCell();
                cell.textContent = value;
            });
        });

        container.replaceChildren(table);
    } catch (error) {
        container.textContent =
            "Unable to load reports. Please check that Flask is running.";
    }
}

loadCommunityReports();

async function loadDashboardStats() {
    try {
        const response = await fetch("/api/stats");

        if (!response.ok) {
            throw new Error("Could not load statistics");
        }

        const stats = await response.json();

        document.getElementById("phone-report-count").textContent =
            stats.phone_reports;

        document.getElementById("phone-check-count").textContent =
            stats.phone_checks;

        document.getElementById("url-scan-count").textContent =
            stats.url_scans;

        document.getElementById("url-report-count").textContent =
            stats.url_reports;

        document.getElementById("top-phone-number").textContent =
            stats.top_phone;

        document.getElementById("top-phone-count").textContent =
            stats.top_phone_count + " community reports";

        document.getElementById("top-reported-url").textContent =
            stats.top_url;

        document.getElementById("top-url-count").textContent =
            stats.top_url_count + " community reports";

    } catch (error) {
        console.error("Dashboard statistics error:", error);
    }
}

loadDashboardStats();

/* =====================================
   6. LOAD RECENT DASHBOARD ACTIVITY
===================================== */

async function loadRecentActivity() {
    const container = document.getElementById("recent-activity");

    try {
        const response = await fetch("/api/recent-activity");

        if (!response.ok) {
            throw new Error("Unable to load recent activity");
        }

        const activities = await response.json();

        container.replaceChildren();

        if (activities.length === 0) {
            container.textContent = "No recent activity available.";
            return;
        }

        activities.forEach(function (activity) {
            const card = document.createElement("div");
            card.className = "phone-report";

            const heading = document.createElement("strong");
            heading.textContent = activity.activity_type;

            const item = document.createElement("p");
            item.textContent = activity.item;

            const date = document.createElement("small");
            date.textContent = "Date: " + activity.activity_date;

            card.appendChild(heading);
            card.appendChild(item);
            card.appendChild(date);

            container.appendChild(card);
        });

    } catch (error) {
        container.textContent = "Unable to load recent activity.";
        console.error(error);
    }
}

loadRecentActivity();
/* =====================================
   7. SUBMIT URL SCAM REPORT
===================================== */

document.getElementById("url-report-form").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const url = document.getElementById("report-url").value.trim();
        const category = document.getElementById("url-scam-category").value;
        const details = document.getElementById("url-report-details").value.trim();
        const result = document.getElementById("url-report-result");

        if (!url) {
            result.textContent = "Please enter a URL.";
            return;
        }

        if (!category) {
            result.textContent = "Please select a scam category.";
            return;
        }

        if (details.length < 20) {
            result.textContent =
                "Please provide at least 20 characters of detail.";
            return;
        }

        result.textContent = "Submitting URL report...";

        try {
            const response = await fetch("/api/url-reports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    url: url,
                    category: category,
                    details: details
                })
            });

            const data = await response.json();

            result.textContent = data.message;

            if (response.ok) {
                document.getElementById("url-report-form").reset();
                loadDashboardStats();
            }

        } catch (error) {
            result.textContent =
                "Could not connect to Flask. Check that the server is running.";
        }
    }
);