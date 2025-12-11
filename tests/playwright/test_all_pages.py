#!/usr/bin/env python3
"""
MedFlow Comprehensive UI Test Suite
Tests all pages, captures screenshots, and validates functionality
"""

import json
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

# Configuration
BASE_URL = "http://localhost:5173"
BACKEND_URL = "http://localhost:5001"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots"
REPORT_FILE = "/Users/xtm888/magloire/tests/playwright/test_report.json"

# Test credentials (from Login.jsx demo credentials)
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Page definitions with expected elements
PAGES_TO_TEST = {
    # Public pages (no auth required)
    "public": [
        {"path": "/login", "name": "Login", "expected": ["input", "button"]},
        {"path": "/book", "name": "Public Booking", "expected": []},
        {"path": "/booking/confirmation", "name": "Booking Confirmation", "expected": []},
        {"path": "/display-board", "name": "Queue Display Board", "expected": []},
    ],
    # Core pages
    "core": [
        {"path": "/home", "name": "Home Dashboard", "expected": []},
        {"path": "/dashboard", "name": "Dashboard", "expected": []},
        {"path": "/patients", "name": "Patients List", "expected": ["table", "button"]},
        {"path": "/queue", "name": "Queue", "expected": []},
        {"path": "/queue/analytics", "name": "Queue Analytics", "expected": []},
        {"path": "/appointments", "name": "Appointments", "expected": []},
        {"path": "/prescriptions", "name": "Prescriptions", "expected": []},
        {"path": "/imaging", "name": "Imaging", "expected": []},
        {"path": "/notifications", "name": "Notifications", "expected": []},
        {"path": "/alerts", "name": "Alert Dashboard", "expected": []},
    ],
    # Financial pages
    "financial": [
        {"path": "/financial", "name": "Financial Dashboard", "expected": []},
        {"path": "/invoicing", "name": "Invoicing", "expected": []},
        {"path": "/services", "name": "Services", "expected": []},
        {"path": "/companies", "name": "Companies", "expected": []},
        {"path": "/approvals", "name": "Approvals", "expected": []},
    ],
    # Clinical pages
    "clinical": [
        {"path": "/laboratory", "name": "Laboratory", "expected": []},
        {"path": "/ophthalmology", "name": "Ophthalmology Dashboard", "expected": []},
        {"path": "/ivt", "name": "IVT Dashboard", "expected": []},
        {"path": "/surgery", "name": "Surgery Dashboard", "expected": []},
        {"path": "/pharmacy", "name": "Pharmacy Dashboard", "expected": []},
        {"path": "/orthoptic", "name": "Orthoptic Exams", "expected": []},
    ],
    # Device & Integration pages
    "devices": [
        {"path": "/devices", "name": "Device Manager", "expected": []},
        {"path": "/devices/status", "name": "Device Status", "expected": []},
        {"path": "/devices/discovery", "name": "Network Discovery", "expected": []},
    ],
    # Inventory pages
    "inventory": [
        {"path": "/frame-inventory", "name": "Frame Inventory", "expected": []},
        {"path": "/contact-lens-inventory", "name": "Contact Lens Inventory", "expected": []},
        {"path": "/optical-lens-inventory", "name": "Optical Lens Inventory", "expected": []},
        {"path": "/reagent-inventory", "name": "Reagent Inventory", "expected": []},
        {"path": "/lab-consumable-inventory", "name": "Lab Consumable Inventory", "expected": []},
        {"path": "/cross-clinic-inventory", "name": "Cross-Clinic Inventory", "expected": []},
    ],
    # Optical Shop pages
    "optical_shop": [
        {"path": "/optical-shop", "name": "Optical Shop Dashboard", "expected": []},
        {"path": "/optical-shop/verification", "name": "Technician Verification", "expected": []},
        {"path": "/optical-shop/external-orders", "name": "External Orders", "expected": []},
        {"path": "/optical-shop/performance", "name": "Optician Performance", "expected": []},
        {"path": "/glasses-orders", "name": "Glasses Orders List", "expected": []},
    ],
    # Admin pages
    "admin": [
        {"path": "/settings", "name": "Settings", "expected": []},
        {"path": "/audit", "name": "Audit Trail", "expected": []},
        {"path": "/users", "name": "User Management", "expected": []},
        {"path": "/backups", "name": "Backup Management", "expected": []},
        {"path": "/analytics", "name": "Analytics Dashboard", "expected": []},
        {"path": "/templates", "name": "Template Manager", "expected": []},
    ],
    # Procurement pages
    "procurement": [
        {"path": "/purchase-orders", "name": "Purchase Orders", "expected": []},
        {"path": "/stock-reconciliation", "name": "Stock Reconciliation", "expected": []},
        {"path": "/warranties", "name": "Warranty Management", "expected": []},
        {"path": "/repairs", "name": "Repair Tracking", "expected": []},
    ],
    # Workflow pages
    "workflow": [
        {"path": "/visits", "name": "Visit Dashboard", "expected": []},
        {"path": "/prescription-queue", "name": "Prescription Queue", "expected": []},
        {"path": "/lab-worklist", "name": "Lab Tech Worklist", "expected": []},
        {"path": "/lab-checkin", "name": "Lab Check-in", "expected": []},
        {"path": "/nurse-vitals", "name": "Nurse Vitals Entry", "expected": []},
    ],
    # Cross-clinic pages
    "cross_clinic": [
        {"path": "/cross-clinic-dashboard", "name": "Cross-Clinic Dashboard", "expected": []},
        {"path": "/consolidated-reports", "name": "Consolidated Reports", "expected": []},
        {"path": "/external-facilities", "name": "External Facilities", "expected": []},
        {"path": "/dispatch-dashboard", "name": "Dispatch Dashboard", "expected": []},
    ],
    # OCR/Import pages
    "import": [
        {"path": "/ocr/import", "name": "Import Wizard", "expected": []},
        {"path": "/ocr/review", "name": "OCR Review Queue", "expected": []},
    ],
}

class TestResult:
    def __init__(self, path, name, category):
        self.path = path
        self.name = name
        self.category = category
        self.success = False
        self.screenshot_path = None
        self.load_time_ms = 0
        self.console_errors = []
        self.console_warnings = []
        self.elements_found = {}
        self.error_message = None
        self.http_errors = []

    def to_dict(self):
        return {
            "path": self.path,
            "name": self.name,
            "category": self.category,
            "success": self.success,
            "screenshot_path": self.screenshot_path,
            "load_time_ms": self.load_time_ms,
            "console_errors": self.console_errors,
            "console_warnings": self.console_warnings,
            "elements_found": self.elements_found,
            "error_message": self.error_message,
            "http_errors": self.http_errors,
        }


def ensure_screenshot_dir():
    """Create screenshot directory if it doesn't exist"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    # Create subdirs for each category
    for category in PAGES_TO_TEST.keys():
        os.makedirs(os.path.join(SCREENSHOT_DIR, category), exist_ok=True)


def login_and_save_state(page, context):
    """Login and return auth state for subsequent tests"""
    print("\n🔐 Logging in...")

    # Navigate to login
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")

    # Wait for the form to be ready
    page.wait_for_timeout(500)

    # Fill login form using specific IDs from Login.jsx
    email_input = page.locator('#email')
    password_input = page.locator('#password')

    if email_input.count() > 0:
        email_input.fill(TEST_USER)
        print(f"  Filled email: {TEST_USER}")

    if password_input.count() > 0:
        password_input.fill(TEST_PASSWORD)
        print(f"  Filled password: ***")

    # Screenshot before login
    page.screenshot(path=f"{SCREENSHOT_DIR}/public/login_filled.png")

    # Click login button (the submit button says "Se connecter")
    login_btn = page.locator('button[type="submit"]')
    if login_btn.count() > 0:
        print("  Clicking login button...")
        login_btn.click()

        # Wait for navigation away from login page
        try:
            # Wait for URL to change (should go to /home)
            page.wait_for_url("**/home", timeout=15000)
            print("✅ Login successful! Redirected to /home")

            # Wait for page to fully load
            page.wait_for_load_state("networkidle")

            # Save storage state for authenticated requests
            storage = context.storage_state()
            return storage
        except Exception as e:
            # Check current URL to see if we're still on login
            current_url = page.url
            print(f"⚠️  Current URL: {current_url}")

            # If we're not on login anymore, login probably succeeded
            if "/login" not in current_url:
                print("✅ Login appears successful (not on login page)")
                storage = context.storage_state()
                return storage

            print(f"⚠️  Login may have failed: {e}")
            page.screenshot(path=f"{SCREENSHOT_DIR}/public/login_error.png")

            # Check for error message
            error_msg = page.locator('.bg-red-50, .text-red-700, [class*="error"]')
            if error_msg.count() > 0:
                print(f"  Error message: {error_msg.first.inner_text()[:100]}")

    return None


def test_page(page, path, name, category, expected_elements):
    """Test a single page and capture results"""
    result = TestResult(path, name, category)
    console_logs = []
    http_errors = []

    # Capture console messages
    def handle_console(msg):
        if msg.type == "error":
            console_logs.append({"type": "error", "text": msg.text})
        elif msg.type == "warning":
            console_logs.append({"type": "warning", "text": msg.text})

    # Capture failed requests
    def handle_request_failed(request):
        http_errors.append({
            "url": request.url,
            "method": request.method,
            "failure": request.failure
        })

    def handle_response(response):
        if response.status >= 400:
            http_errors.append({
                "url": response.url,
                "status": response.status,
                "statusText": response.status_text
            })

    page.on("console", handle_console)
    page.on("requestfailed", handle_request_failed)
    page.on("response", handle_response)

    try:
        # Navigate to page
        start_time = datetime.now()
        page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")

        # Wait for network to settle (but with timeout)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except:
            pass  # Continue even if network doesn't fully settle

        load_time = (datetime.now() - start_time).total_seconds() * 1000
        result.load_time_ms = round(load_time, 2)

        # Small delay for React to render
        page.wait_for_timeout(500)

        # Check for expected elements
        for elem_type in expected_elements:
            count = page.locator(elem_type).count()
            result.elements_found[elem_type] = count

        # Check page has content (not blank or error page)
        body_text = page.locator("body").inner_text()
        has_content = len(body_text.strip()) > 50

        # Check for common error indicators
        error_indicators = page.locator('text=/error|Error|failed|Failed|404|500/i').count()

        # Take screenshot
        screenshot_name = path.replace("/", "_").strip("_") or "root"
        screenshot_path = f"{SCREENSHOT_DIR}/{category}/{screenshot_name}.png"
        page.screenshot(path=screenshot_path, full_page=True)
        result.screenshot_path = screenshot_path

        # Determine success
        result.console_errors = [log["text"] for log in console_logs if log["type"] == "error"]
        result.console_warnings = [log["text"] for log in console_logs if log["type"] == "warning"]
        result.http_errors = http_errors

        # Page is successful if it loaded content and no major errors
        critical_errors = [e for e in result.console_errors if "uncaught" in e.lower() or "undefined" in e.lower()]
        result.success = has_content and len(critical_errors) == 0

        if result.success:
            print(f"  ✅ {name} ({path}) - {result.load_time_ms}ms")
        else:
            print(f"  ⚠️  {name} ({path}) - has issues")

    except Exception as e:
        result.error_message = str(e)
        result.success = False
        print(f"  ❌ {name} ({path}) - {e}")

        # Try to take error screenshot
        try:
            screenshot_name = path.replace("/", "_").strip("_") or "root"
            screenshot_path = f"{SCREENSHOT_DIR}/{category}/{screenshot_name}_error.png"
            page.screenshot(path=screenshot_path)
            result.screenshot_path = screenshot_path
        except:
            pass

    finally:
        # Remove listeners
        page.remove_listener("console", handle_console)
        page.remove_listener("requestfailed", handle_request_failed)
        page.remove_listener("response", handle_response)

    return result


def generate_report(results):
    """Generate comprehensive test report"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "total_pages": len(results),
        "passed": sum(1 for r in results if r.success),
        "failed": sum(1 for r in results if not r.success),
        "categories": {},
        "results": [r.to_dict() for r in results],
    }

    # Group by category
    for result in results:
        if result.category not in report["categories"]:
            report["categories"][result.category] = {"passed": 0, "failed": 0, "pages": []}

        if result.success:
            report["categories"][result.category]["passed"] += 1
        else:
            report["categories"][result.category]["failed"] += 1

        report["categories"][result.category]["pages"].append(result.name)

    # Save report
    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)

    return report


def print_summary(report):
    """Print test summary to console"""
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"Total Pages Tested: {report['total_pages']}")
    print(f"✅ Passed: {report['passed']}")
    print(f"❌ Failed: {report['failed']}")
    print(f"Success Rate: {report['passed']/report['total_pages']*100:.1f}%")
    print()

    print("By Category:")
    for category, data in report["categories"].items():
        status = "✅" if data["failed"] == 0 else "⚠️"
        print(f"  {status} {category}: {data['passed']}/{data['passed']+data['failed']} passed")

    print()
    print(f"📄 Full report saved to: {REPORT_FILE}")
    print(f"📸 Screenshots saved to: {SCREENSHOT_DIR}")

    # List failed pages
    failed = [r for r in report["results"] if not r["success"]]
    if failed:
        print("\n❌ Failed Pages:")
        for r in failed:
            print(f"  - {r['name']} ({r['path']})")
            if r.get("error_message"):
                print(f"    Error: {r['error_message'][:100]}")
            if r.get("console_errors"):
                print(f"    Console errors: {len(r['console_errors'])}")


def main():
    """Main test runner"""
    print("🚀 MedFlow UI Test Suite")
    print("="*60)

    ensure_screenshot_dir()
    results = []

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            ignore_https_errors=True
        )
        page = context.new_page()

        # Test public pages first (no auth needed)
        print("\n📄 Testing PUBLIC pages...")
        for page_def in PAGES_TO_TEST["public"]:
            result = test_page(page, page_def["path"], page_def["name"], "public", page_def.get("expected", []))
            results.append(result)

        # Login for authenticated pages
        auth_state = login_and_save_state(page, context)

        if auth_state:
            # Test all authenticated page categories
            for category, pages in PAGES_TO_TEST.items():
                if category == "public":
                    continue  # Already tested

                print(f"\n📄 Testing {category.upper()} pages...")
                for page_def in pages:
                    result = test_page(page, page_def["path"], page_def["name"], category, page_def.get("expected", []))
                    results.append(result)
        else:
            print("⚠️  Skipping authenticated pages due to login failure")

        browser.close()

    # Generate and print report
    report = generate_report(results)
    print_summary(report)

    # Return exit code based on results
    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
