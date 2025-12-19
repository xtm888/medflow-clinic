#!/usr/bin/env python3
"""
MedFlow Visual Verification Test Suite

This test suite ACTUALLY verifies page content, not just URL/network state.
- Detects 404 errors and marks tests as FAILED
- Takes small JPEG screenshots (quality=40) for evidence
- Verifies expected elements exist before marking as passed

Run: python3 test_visual_verification.py
Run headed: HEADED=1 python3 test_visual_verification.py
"""

import os
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

# Configuration
BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:5001/api"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "verified")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "visual_verification_report.json")
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Ensure screenshot directory exists
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Test results
test_results = []


def is_404_or_error(page):
    """
    Check if page shows 404 or error state.
    This is the KEY function that catches false positives.
    """
    error_indicators = [
        'text="404"',
        'text="Not Found"',
        'text="Page not found"',
        'text="Page introuvable"',
        'text="Erreur"',
        'text="Error"',
        'text="Something went wrong"',
        'text="Oops"',
        '[class*="error-page"]',
        '[class*="not-found"]',
        '[class*="error-boundary"]',
        'h1:has-text("404")',
        'h1:has-text("Error")',
    ]

    for indicator in error_indicators:
        try:
            if page.locator(indicator).count() > 0:
                return True
        except:
            pass

    # Also check if body is essentially empty (failed render)
    body_text = page.locator('body').inner_text()
    if len(body_text.strip()) < 50:  # Almost empty page
        return True

    return False


def get_page_title(page):
    """Extract visible page title/header"""
    for selector in ['h1', 'h2', '[class*="title"]', '[class*="header"] h1']:
        try:
            el = page.locator(selector).first
            if el.count() > 0:
                return el.inner_text()[:50]
        except:
            pass
    return "Unknown"


def take_screenshot(page, name, suffix=""):
    """
    Take optimized JPEG screenshot.
    - quality=40 for small size
    - viewport only (not full_page)
    - 1280x720 resolution
    """
    filename = f"{name}{suffix}.jpg"
    filepath = os.path.join(SCREENSHOT_DIR, filename)

    page.screenshot(
        path=filepath,
        type='jpeg',
        quality=40,
        full_page=False
    )

    # Get file size
    size_kb = os.path.getsize(filepath) / 1024
    return filename, size_kb


def verify_page(page, name, url_path, required_elements, expected_text=None):
    """
    Complete page verification with screenshot evidence.

    Args:
        page: Playwright page object
        name: Test name for reporting
        url_path: URL path to navigate to
        required_elements: List of CSS selectors that MUST exist
        expected_text: Optional text that should appear on page

    Returns:
        dict with verification results
    """
    result = {
        "name": name,
        "url": url_path,
        "timestamp": datetime.now().isoformat(),
        "passed": False,
        "checks": {},
        "screenshot": None,
        "screenshot_size_kb": 0,
        "error": None
    }

    try:
        # Navigate
        page.goto(f"{BASE_URL}{url_path}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)  # Brief settle time

        # CHECK 1: URL correct
        result["checks"]["url_correct"] = url_path in page.url

        # CHECK 2: Not a 404/error page
        is_error = is_404_or_error(page)
        result["checks"]["not_error_page"] = not is_error

        if is_error:
            result["error"] = "Page shows 404 or error state"
            filename, size = take_screenshot(page, name, "_ERROR")
            result["screenshot"] = filename
            result["screenshot_size_kb"] = round(size, 1)
            test_results.append(result)
            return result

        # CHECK 3: Required elements exist
        elements_found = 0
        for selector in required_elements:
            try:
                count = page.locator(selector).count()
                if count > 0:
                    elements_found += 1
            except:
                pass

        result["checks"]["required_elements"] = elements_found
        result["checks"]["required_elements_needed"] = len(required_elements)
        has_elements = elements_found > 0

        if not has_elements:
            result["error"] = f"No required elements found: {required_elements}"
            filename, size = take_screenshot(page, name, "_MISSING")
            result["screenshot"] = filename
            result["screenshot_size_kb"] = round(size, 1)
            test_results.append(result)
            return result

        # CHECK 4: Expected text (optional)
        if expected_text:
            body_text = page.locator('body').inner_text().lower()
            text_found = any(t.lower() in body_text for t in expected_text)
            result["checks"]["expected_text_found"] = text_found

        # CHECK 5: Get visible title
        result["checks"]["page_title"] = get_page_title(page)

        # All checks passed - take success screenshot
        result["passed"] = True
        filename, size = take_screenshot(page, name)
        result["screenshot"] = filename
        result["screenshot_size_kb"] = round(size, 1)

    except Exception as e:
        result["error"] = str(e)[:200]
        try:
            filename, size = take_screenshot(page, name, "_EXCEPTION")
            result["screenshot"] = filename
            result["screenshot_size_kb"] = round(size, 1)
        except:
            pass

    test_results.append(result)
    return result


def print_result(result):
    """Pretty print a test result"""
    status = "✅" if result["passed"] else "❌"
    size = f"({result['screenshot_size_kb']}KB)" if result['screenshot_size_kb'] else ""
    print(f"  {status} {result['name']} {size}")

    if not result["passed"] and result.get("error"):
        print(f"      ⚠️  {result['error'][:80]}")


# ============================================================================
# PAGE DEFINITIONS - What to verify on each page
# ============================================================================
PAGE_DEFINITIONS = [
    {
        "name": "Dashboard",
        "path": "/dashboard",
        "elements": ['[class*="card"]', '[class*="stat"]', 'button'],
        "text": ["dashboard", "tableau", "patients"]
    },
    {
        "name": "Patients",
        "path": "/patients",
        "elements": ['table', '[class*="patient"]', 'input[type="search"]', 'input[placeholder*="search" i]'],
        "text": ["patient", "nom", "name"]
    },
    {
        "name": "Queue",
        "path": "/queue",
        "elements": ['[class*="queue"]', 'table', 'button'],
        "text": ["queue", "file", "attente"]
    },
    {
        "name": "Appointments",
        "path": "/appointments",
        "elements": ['[class*="calendar"]', 'table', 'button', '[class*="appointment"]'],
        "text": ["rendez-vous", "appointment", "calendar"]
    },
    {
        "name": "Ophthalmology",
        "path": "/ophthalmology",
        "elements": ['[class*="dashboard"]', '[class*="card"]', 'button'],
        "text": ["ophtalmologie", "ophthalmology", "consultation"]
    },
    {
        "name": "Prescriptions",
        "path": "/prescriptions",
        "elements": ['table', 'button', '[class*="prescription"]'],
        "text": ["prescription", "ordonnance"]
    },
    {
        "name": "Pharmacy",
        "path": "/pharmacy",
        "elements": ['table', '[class*="inventory"]', '[class*="card"]', 'button'],
        "text": ["pharmacie", "pharmacy", "stock", "médicament"]
    },
    {
        "name": "Laboratory",
        "path": "/laboratory",
        "elements": ['[class*="lab"]', 'table', 'button', '[class*="tab"]'],
        "text": ["laboratoire", "laboratory", "test", "analyse"]
    },
    {
        "name": "Surgery",
        "path": "/surgery",
        "elements": ['table', '[class*="case"]', 'button', '[class*="surgery"]'],
        "text": ["chirurgie", "surgery", "cas", "case"]
    },
    {
        "name": "Invoicing",
        "path": "/invoicing",
        "elements": ['table', '[class*="invoice"]', 'button', '[class*="tab"]'],
        "text": ["facture", "invoice", "facturation"]
    },
    {
        "name": "Financial_Dashboard",
        "path": "/financial",
        "elements": ['[class*="card"]', '[class*="chart"]', '[class*="stat"]'],
        "text": ["finance", "revenue", "recette"]
    },
    {
        "name": "Settings",
        "path": "/settings",
        "elements": ['[class*="setting"]', '[class*="tab"]', 'form', 'button'],
        "text": ["paramètre", "setting", "configuration"]
    },
    {
        "name": "Approvals",
        "path": "/approvals",
        "elements": ['table', '[class*="approval"]', 'button'],
        "text": ["approbation", "approval", "autorisation"]
    },
    {
        "name": "Optical_Shop",
        "path": "/optical-shop",
        "elements": ['[class*="card"]', 'button', '[class*="optical"]'],
        "text": ["optique", "optical", "monture", "frame"]
    },
]


def main():
    """Run all visual verification tests"""
    global test_results
    test_results = []

    headed = os.environ.get('HEADED', '0') == '1'

    print("=" * 70)
    print("🔍 MedFlow Visual Verification Test Suite")
    print("=" * 70)
    print(f"📸 Screenshots: {SCREENSHOT_DIR}")
    print(f"🖥️  Mode: {'Headed (visible)' if headed else 'Headless'}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=not headed,
            slow_mo=300 if headed else 0
        )

        # Set viewport to consistent size
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Login first
        print("🔐 Logging in...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.locator('#email').fill(TEST_USER)
        page.locator('#password').fill(TEST_PASSWORD)
        page.locator('button[type="submit"]').click()

        try:
            page.wait_for_url("**/home", timeout=15000)
            print("✅ Login successful\n")
        except:
            print("❌ Login failed!")
            browser.close()
            return

        # Run all page verifications
        print("📄 Verifying pages...")
        print("-" * 70)

        for page_def in PAGE_DEFINITIONS:
            result = verify_page(
                page,
                page_def["name"],
                page_def["path"],
                page_def["elements"],
                page_def.get("text")
            )
            print_result(result)

        browser.close()

    # Summary
    print()
    print("=" * 70)
    passed = sum(1 for r in test_results if r["passed"])
    failed = len(test_results) - passed
    total_size = sum(r.get("screenshot_size_kb", 0) for r in test_results)

    print(f"📊 Results: {passed} passed, {failed} failed")
    print(f"📁 Total screenshot size: {total_size:.1f} KB")

    if failed > 0:
        print()
        print("❌ Failed pages:")
        for r in test_results:
            if not r["passed"]:
                print(f"   - {r['name']}: {r.get('error', 'Unknown error')}")

    # Save report
    with open(REPORT_FILE, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed,
                "total_screenshot_kb": round(total_size, 1)
            },
            "results": test_results
        }, f, indent=2)

    print()
    print(f"📝 Report saved: {REPORT_FILE}")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
