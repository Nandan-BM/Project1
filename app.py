
from flask import Flask, render_template, request, jsonify
import sqlite3
import re
from ml.predict import predict_url

app = Flask(__name__)
DATABASE = "scamshield.db"


# =====================================
# 1. DATABASE CREATION
# =====================================

def create_database():
    with sqlite3.connect(DATABASE) as conn:

        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                category TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS phone_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS url_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                prediction TEXT,
                scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS url_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                category TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


# =====================================
# 2. HOME PAGE
# =====================================

@app.route("/")
def home():
    return render_template("index.html")


# =====================================
# 3. SUBMIT PHONE REPORT
# =====================================

@app.route("/api/reports", methods=["POST"])
def submit_report():
    data = request.get_json(silent=True) or {}

    phone = data.get("phone", "").strip()
    category = data.get("category", "").strip()
    details = data.get("details", "").strip()

    if not re.fullmatch(r"\+?[0-9\s()-]{7,20}", phone):
        return jsonify({"message": "Enter a valid-looking phone number."}), 400

    allowed_categories = {
        "Banking fraud",
        "Fake customer support",
        "Lottery or prize scam",
        "Job scam",
        "Impersonation",
        "Other"
    }

    if category not in allowed_categories:
        return jsonify({"message": "Please select a valid scam category."}), 400

    if len(details) < 20:
        return jsonify({"message": "Please provide at least 20 characters of detail."}), 400

    with sqlite3.connect(DATABASE) as conn:
        conn.execute(
            "INSERT INTO reports (phone, category, details) VALUES (?, ?, ?)",
            (phone, category, details)
        )

    return jsonify({
        "message": "Report saved successfully in the database."
    }), 201


# =====================================
# 4. GET PHONE REPORTS
# =====================================

@app.route("/api/reports", methods=["GET"])
def get_reports():
    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT id, phone, category, details, created_at
            FROM reports
            ORDER BY id DESC
        """).fetchall()

    return jsonify([dict(row) for row in rows])


# =====================================
# 5. PHONE NUMBER CHECKER
# =====================================

@app.route("/api/phones/<phone>", methods=["GET"])
def check_phone(phone):
    phone = phone.strip()

    if not re.fullmatch(r"\+?[0-9\s()-]{7,20}", phone):
        return jsonify({"message": "Enter a valid-looking phone number."}), 400

    normalized_phone = re.sub(r"[\s()-]", "", phone)

    # Record phone search
    with sqlite3.connect(DATABASE) as conn:
        conn.execute(
            "INSERT INTO phone_checks (phone) VALUES (?)",
            (phone,)
        )

        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT category, details, created_at
            FROM reports
            WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?
            ORDER BY id DESC
        """, (normalized_phone,)).fetchall()

    reports = [dict(row) for row in rows]

    return jsonify({
        "phone": phone,
        "report_count": len(reports),
        "reports": reports,
        "message": (
            "Community reports found. These reports are unverified."
            if reports else
            "No community reports found for this number. This does not guarantee it is safe."
        )
    })


# =====================================
# 6. URL SCANNER
# =====================================

@app.route("/api/scan-url", methods=["POST"])
def scan_url():
    data = request.get_json(silent=True) or {}

    url = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "Please enter a URL"}), 400

    try:
        result = predict_url(url)

        # Save URL scan history
        with sqlite3.connect(DATABASE) as conn:
            conn.execute(
                "INSERT INTO url_scans (url, prediction) VALUES (?, ?)",
                (url, result["prediction"])
            )

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =====================================
# 6A. SUBMIT URL REPORT
# =====================================

@app.route("/api/url-reports", methods=["POST"])
def submit_url_report():
    data = request.get_json(silent=True) or {}

    url = data.get("url", "").strip()
    category = data.get("category", "").strip()
    details = data.get("details", "").strip()

    if not url:
        return jsonify({"message": "Please enter a URL."}), 400

    if category not in {
        "Phishing",
        "Fake shopping website",
        "Malware",
        "Impersonation",
        "Other"
    }:
        return jsonify({"message": "Please select a valid category."}), 400

    if len(details) < 20:
        return jsonify({
            "message": "Please provide at least 20 characters of detail."
        }), 400

    with sqlite3.connect(DATABASE) as conn:
        conn.execute(
            """
            INSERT INTO url_reports (url, category, details)
            VALUES (?, ?, ?)
            """,
            (url, category, details)
        )

    return jsonify({
        "message": "URL report saved successfully."
    }), 201
# =====================================
# 6B. GET URL REPORTS
# =====================================

@app.route("/api/url-reports", methods=["GET"])
def get_url_reports():
    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT id, url, category, details, created_at
            FROM url_reports
            ORDER BY id DESC
        """).fetchall()

    return jsonify([dict(row) for row in rows])
# =====================================
# 7. DASHBOARD STATISTICS
# =====================================

@app.route("/api/stats")
def get_stats():
    with sqlite3.connect(DATABASE) as conn:

        phone_reports = conn.execute(
            "SELECT COUNT(*) FROM reports"
        ).fetchone()[0]

        phone_checks = conn.execute(
            "SELECT COUNT(*) FROM phone_checks"
        ).fetchone()[0]

        url_scans = conn.execute(
            "SELECT COUNT(*) FROM url_scans"
        ).fetchone()[0]

        url_reports = conn.execute(
            "SELECT COUNT(*) FROM url_reports"
        ).fetchone()[0]

        top_phone = conn.execute("""
            SELECT phone, COUNT(*) AS total
            FROM reports
            GROUP BY phone
            ORDER BY total DESC, phone ASC
            LIMIT 1
        """).fetchone()

        top_url = conn.execute("""
            SELECT url, COUNT(*) AS total
            FROM url_reports
            GROUP BY url
            ORDER BY total DESC, url ASC
            LIMIT 1
        """).fetchone()

    return jsonify({
        "phone_reports": phone_reports,
        "phone_checks": phone_checks,
        "url_scans": url_scans,
        "url_reports": url_reports,
        "top_phone": top_phone[0] if top_phone else "No reports yet",
        "top_phone_count": top_phone[1] if top_phone else 0,
        "top_url": top_url[0] if top_url else "No reports yet",
        "top_url_count": top_url[1] if top_url else 0
    })


# =====================================
# 8. RUN APPLICATION
# =====================================

# =====================================
# 9. RECENT DASHBOARD ACTIVITY
# =====================================

@app.route("/api/recent-activity")
def recent_activity():
    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row

        phone_reports = conn.execute("""
            SELECT
                'Phone Report' AS activity_type,
                phone AS item,
                created_at AS activity_date
            FROM reports
        """).fetchall()

        url_scans = conn.execute("""
            SELECT
                'URL Scan' AS activity_type,
                url AS item,
                scanned_at AS activity_date
            FROM url_scans
        """).fetchall()

        phone_checks = conn.execute("""
            SELECT
                'Phone Check' AS activity_type,
                phone AS item,
                checked_at AS activity_date
            FROM phone_checks
        """).fetchall()

    activities = [
        dict(row)
        for row in phone_reports + url_scans + phone_checks
    ]

    activities.sort(
        key=lambda x: x["activity_date"] or "",
        reverse=True
    )

    return jsonify(activities[:10])

if __name__ == "__main__":
    create_database()
    app.run(debug=True)
