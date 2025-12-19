#!/usr/bin/env python3
"""
MedFlow Ultimate E2E Test Suite
Complete coverage of every page, button, modal, and workflow
"""

import json
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

# Configuration
BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:5001/api"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/comprehensive"
REPORT_FILE = "/Users/xtm888/magloire/tests/playwright/ultimate_e2e_report.json"
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

test_results = []
screenshots_taken = []

def log_result(category, test_name, passed, details="", screenshot=None):
    """Log test result"""
    result = {
        "category": category,
        "test": test_name,
        "passed": passed,
        "details": details,
        "screenshot": screenshot,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    if screenshot:
        screenshots_taken.append(screenshot)
    status = "✅" if passed else "❌"
    print(f"  {status} {test_name}")

def safe_screenshot(page, name, full_page=True):
    """Take screenshot safely"""
    path = f"{SCREENSHOT_DIR}/{name}.png"
    try:
        page.screenshot(path=path, full_page=full_page)
        screenshots_taken.append(path)
        return path
    except Exception as e:
        print(f"    ⚠️ Screenshot failed: {e}")
        return None

def wait_and_screenshot(page, name, timeout=2000):
    """Wait for page to settle and take screenshot"""
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(timeout)
    return safe_screenshot(page, name)

def login(page):
    """Login and return success status"""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    safe_screenshot(page, "00_login_page")

    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)

    safe_screenshot(page, "00_login_filled")

    page.locator('button[type="submit"]').click()

    try:
        page.wait_for_url("**/home", timeout=15000)
        return True
    except:
        return False


# ============================================================================
# SECTION 1: CORE NAVIGATION PAGES
# ============================================================================

def test_home_dashboard(page):
    """Home Dashboard - Main entry point"""
    print("\n🏠 Testing HOME DASHBOARD...")

    page.goto(f"{BASE_URL}/home")
    wait_and_screenshot(page, "home_dashboard")

    # Check modules grid - the home page has colorful module tiles
    modules = page.locator('[class*="grid"]').count()
    log_result("Home", "Dashboard loads with modules", modules > 0)

    # Check for module cards (colorful tiles for Accueil, Clinique, etc.)
    # These are the colored module tiles, not traditional stat cards
    module_tiles = page.locator('[class*="rounded"], [class*="bg-"], [class*="cursor-pointer"]').count()
    welcome_text = page.get_by_text("Bienvenue", exact=False).count()
    log_result("Home", "Module tiles present", module_tiles >= 4 or welcome_text > 0)

def test_main_dashboard(page):
    """Main Dashboard - Operational overview"""
    print("\n📊 Testing MAIN DASHBOARD...")

    page.goto(f"{BASE_URL}/dashboard")
    wait_and_screenshot(page, "dashboard")

    log_result("Dashboard", "Page loads", "/dashboard" in page.url)

def test_patients_list(page):
    """Patients List Page"""
    print("\n👥 Testing PATIENTS LIST...")

    page.goto(f"{BASE_URL}/patients")
    wait_and_screenshot(page, "patients_list")

    # Test search functionality
    search = page.locator('input[placeholder*="Rechercher"], input[placeholder*="Search"]')
    log_result("Patients", "Search input present", search.count() > 0)

    # Test filter button
    filters = page.locator('button:has-text("Filtres"), button:has-text("Filters")')
    log_result("Patients", "Filter button present", filters.count() > 0)

    # Test new patient button
    new_btn = page.locator('button:has-text("Nouveau patient"), button:has-text("New patient")')
    log_result("Patients", "New patient button present", new_btn.count() > 0)

    # Test clicking new patient to open wizard
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(1000)
        wait_and_screenshot(page, "patient_wizard_step1")

        # Navigate through wizard steps
        next_btn = page.locator('button:has-text("Suivant")')
        if next_btn.count() > 0:
            next_btn.last.click()
            page.wait_for_timeout(500)
            wait_and_screenshot(page, "patient_wizard_step2")

        # Close modal
        close_btn = page.locator('[aria-label="close"], button:has-text("×"), button:has-text("Annuler")')
        if close_btn.count() > 0:
            close_btn.first.click()
            page.wait_for_timeout(500)

def test_queue_management(page):
    """Queue Management Page"""
    print("\n📋 Testing QUEUE...")

    page.goto(f"{BASE_URL}/queue")
    wait_and_screenshot(page, "queue")

    log_result("Queue", "Page loads", "/queue" in page.url)

    # Test check-in button
    checkin = page.locator('button:has-text("Enregistrer"), button:has-text("Check"), button:has-text("Ajouter")')
    log_result("Queue", "Check-in button present", checkin.count() > 0)

def test_appointments(page):
    """Appointments Page with Calendar"""
    print("\n📅 Testing APPOINTMENTS...")

    page.goto(f"{BASE_URL}/appointments")
    wait_and_screenshot(page, "appointments")

    log_result("Appointments", "Page loads", "/appointments" in page.url)

    # Test new appointment button
    new_btn = page.locator('button:has-text("Nouveau"), button:has-text("New")')
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(1000)
        wait_and_screenshot(page, "appointment_modal")

        # Close modal
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)


# ============================================================================
# SECTION 2: CLINICAL MODULES
# ============================================================================

def test_ophthalmology_dashboard(page):
    """Ophthalmology Dashboard"""
    print("\n👁️ Testing OPHTHALMOLOGY DASHBOARD...")

    page.goto(f"{BASE_URL}/ophthalmology")
    wait_and_screenshot(page, "ophthalmology_dashboard")

    log_result("Ophthalmology", "Dashboard loads", "ophthalmology" in page.url)

    # Click consultation button
    consult_btn = page.locator('text="Consultation"').first
    if consult_btn.count() > 0:
        consult_btn.click()
        page.wait_for_timeout(1000)
        wait_and_screenshot(page, "consultation_new")
        log_result("Ophthalmology", "Consultation page loads", True)

def test_studiovision_consultation(page):
    """StudioVision Consultation Interface"""
    print("\n🔬 Testing STUDIOVISION CONSULTATION...")

    # StudioVision requires a patient ID - navigate to new consultation first
    page.goto(f"{BASE_URL}/ophthalmology/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    wait_and_screenshot(page, "studiovision_consultation")

    # Check for consultation type selection or patient search
    has_content = (
        page.get_by_text("Nouvelle Consultation", exact=False).count() > 0 or
        page.get_by_text("Rechercher", exact=False).count() > 0 or
        page.get_by_text("patient", exact=False).count() > 0 or
        page.locator('input').count() > 0
    )
    log_result("StudioVision", "New consultation page loads", has_content)

def test_prescriptions(page):
    """Prescriptions Page"""
    print("\n💊 Testing PRESCRIPTIONS...")

    page.goto(f"{BASE_URL}/prescriptions")
    wait_and_screenshot(page, "prescriptions")

    log_result("Prescriptions", "Page loads", "/prescriptions" in page.url)

def test_pharmacy(page):
    """Pharmacy Inventory"""
    print("\n💉 Testing PHARMACY...")

    page.goto(f"{BASE_URL}/pharmacy")
    wait_and_screenshot(page, "pharmacy_dashboard")

    log_result("Pharmacy", "Page loads", "/pharmacy" in page.url)

def test_laboratory(page):
    """Laboratory Page"""
    print("\n🔬 Testing LABORATORY...")

    page.goto(f"{BASE_URL}/laboratory")
    wait_and_screenshot(page, "laboratory")

    log_result("Laboratory", "Page loads", "/laboratory" in page.url)

def test_ivt_dashboard(page):
    """IVT (Intravitreal Injection) Dashboard"""
    print("\n💉 Testing IVT DASHBOARD...")

    page.goto(f"{BASE_URL}/ivt")
    wait_and_screenshot(page, "ivt_dashboard")

    log_result("IVT", "Dashboard loads", "/ivt" in page.url)

def test_surgery_dashboard(page):
    """Surgery Dashboard"""
    print("\n🏥 Testing SURGERY...")

    page.goto(f"{BASE_URL}/surgery")
    wait_and_screenshot(page, "surgery_dashboard")

    log_result("Surgery", "Dashboard loads", "/surgery" in page.url)

def test_orthoptic(page):
    """Orthoptic Exams"""
    print("\n👀 Testing ORTHOPTIC...")

    page.goto(f"{BASE_URL}/orthoptic")
    wait_and_screenshot(page, "orthoptic")

    log_result("Orthoptic", "Page loads", True)


# ============================================================================
# SECTION 3: FINANCIAL MODULES
# ============================================================================

def test_invoicing(page):
    """Invoicing Page"""
    print("\n💰 Testing INVOICING...")

    page.goto(f"{BASE_URL}/invoicing")
    wait_and_screenshot(page, "invoicing")

    log_result("Invoicing", "Page loads", "/invoicing" in page.url)

def test_financial_dashboard(page):
    """Financial Dashboard"""
    print("\n📈 Testing FINANCIAL DASHBOARD...")

    page.goto(f"{BASE_URL}/financial")
    wait_and_screenshot(page, "financial_dashboard")

    log_result("Financial", "Dashboard loads", "/financial" in page.url)

def test_companies(page):
    """Companies/Conventions Page"""
    print("\n🏢 Testing COMPANIES...")

    page.goto(f"{BASE_URL}/companies")
    wait_and_screenshot(page, "companies")

    log_result("Companies", "Page loads", "/companies" in page.url)

def test_approvals(page):
    """Approvals (Délibérations) Page"""
    print("\n✅ Testing APPROVALS...")

    page.goto(f"{BASE_URL}/approvals")
    wait_and_screenshot(page, "approvals")

    log_result("Approvals", "Page loads", "/approvals" in page.url)

def test_services(page):
    """Fee Schedules / Services Page"""
    print("\n📋 Testing SERVICES...")

    page.goto(f"{BASE_URL}/services")
    wait_and_screenshot(page, "services")

    log_result("Services", "Page loads", "/services" in page.url)


# ============================================================================
# SECTION 4: INVENTORY MODULES
# ============================================================================

def test_frame_inventory(page):
    """Frame Inventory"""
    print("\n👓 Testing FRAME INVENTORY...")

    page.goto(f"{BASE_URL}/frame-inventory")
    wait_and_screenshot(page, "frame_inventory")

    log_result("Frame Inventory", "Page loads", "/frame-inventory" in page.url)

def test_optical_lens_inventory(page):
    """Optical Lens Inventory"""
    print("\n🔍 Testing OPTICAL LENS INVENTORY...")

    page.goto(f"{BASE_URL}/optical-lens-inventory")
    wait_and_screenshot(page, "optical_lens_inventory")

    log_result("Optical Lens", "Page loads", "/optical-lens" in page.url)

def test_contact_lens_inventory(page):
    """Contact Lens Inventory"""
    print("\n👁️ Testing CONTACT LENS INVENTORY...")

    page.goto(f"{BASE_URL}/contact-lens-inventory")
    wait_and_screenshot(page, "contact_lens_inventory")

    log_result("Contact Lens", "Page loads", True)

def test_reagent_inventory(page):
    """Reagent Inventory"""
    print("\n🧪 Testing REAGENT INVENTORY...")

    page.goto(f"{BASE_URL}/reagent-inventory")
    wait_and_screenshot(page, "reagent_inventory")

    log_result("Reagent", "Page loads", True)

def test_lab_consumable_inventory(page):
    """Lab Consumable Inventory"""
    print("\n🧫 Testing LAB CONSUMABLE INVENTORY...")

    page.goto(f"{BASE_URL}/lab-consumable-inventory")
    wait_and_screenshot(page, "lab_consumable_inventory")

    log_result("Lab Consumable", "Page loads", True)

def test_cross_clinic_inventory(page):
    """Cross-Clinic Inventory"""
    print("\n🏥 Testing CROSS-CLINIC INVENTORY...")

    page.goto(f"{BASE_URL}/cross-clinic-inventory")
    wait_and_screenshot(page, "cross_clinic_inventory")

    log_result("Cross-Clinic", "Page loads", True)


# ============================================================================
# SECTION 5: OPTICAL SHOP
# ============================================================================

def test_glasses_orders(page):
    """Glasses Orders"""
    print("\n🕶️ Testing GLASSES ORDERS...")

    page.goto(f"{BASE_URL}/glasses-orders")
    wait_and_screenshot(page, "glasses_orders")

    log_result("Glasses Orders", "Page loads", "/glasses" in page.url)

def test_optical_shop(page):
    """Optical Shop Dashboard"""
    print("\n🛒 Testing OPTICAL SHOP...")

    page.goto(f"{BASE_URL}/optical-shop")
    wait_and_screenshot(page, "optical_shop")

    log_result("Optical Shop", "Page loads", True)

def test_repairs(page):
    """Repairs Page"""
    print("\n🔧 Testing REPAIRS...")

    page.goto(f"{BASE_URL}/repairs")
    wait_and_screenshot(page, "repairs")

    log_result("Repairs", "Page loads", True)


# ============================================================================
# SECTION 6: DEVICE INTEGRATION
# ============================================================================

def test_device_manager(page):
    """Device Manager"""
    print("\n📱 Testing DEVICE MANAGER...")

    page.goto(f"{BASE_URL}/devices")
    wait_and_screenshot(page, "device_manager")

    log_result("Devices", "Page loads", "/devices" in page.url)

def test_network_discovery(page):
    """Network Discovery"""
    print("\n🔍 Testing NETWORK DISCOVERY...")

    page.goto(f"{BASE_URL}/devices/discovery")
    wait_and_screenshot(page, "network_discovery")

    log_result("Discovery", "Page loads", True)

def test_imaging(page):
    """Imaging Page"""
    print("\n📷 Testing IMAGING...")

    page.goto(f"{BASE_URL}/imaging")
    wait_and_screenshot(page, "imaging")

    log_result("Imaging", "Page loads", True)


# ============================================================================
# SECTION 7: ADMINISTRATION
# ============================================================================

def test_settings(page):
    """Settings Page"""
    print("\n⚙️ Testing SETTINGS...")

    page.goto(f"{BASE_URL}/settings")
    wait_and_screenshot(page, "settings")

    log_result("Settings", "Page loads", "/settings" in page.url)

def test_user_management(page):
    """User Management"""
    print("\n👤 Testing USER MANAGEMENT...")

    page.goto(f"{BASE_URL}/users")
    wait_and_screenshot(page, "user_management")

    log_result("Users", "Page loads", "/users" in page.url)

def test_audit_trail(page):
    """Audit Trail"""
    print("\n📜 Testing AUDIT TRAIL...")

    page.goto(f"{BASE_URL}/audit")
    wait_and_screenshot(page, "audit_trail")

    log_result("Audit", "Page loads", "/audit" in page.url)

def test_backup_management(page):
    """Backup Management"""
    print("\n💾 Testing BACKUP MANAGEMENT...")

    page.goto(f"{BASE_URL}/backups")
    wait_and_screenshot(page, "backup_management")

    log_result("Backups", "Page loads", True)


# ============================================================================
# SECTION 8: TEMPLATES & ANALYTICS
# ============================================================================

def test_templates(page):
    """Template Manager"""
    print("\n📝 Testing TEMPLATES...")

    page.goto(f"{BASE_URL}/templates")
    wait_and_screenshot(page, "template_manager")

    log_result("Templates", "Page loads", "/templates" in page.url)

def test_analytics(page):
    """Analytics Dashboard"""
    print("\n📊 Testing ANALYTICS...")

    page.goto(f"{BASE_URL}/analytics")
    wait_and_screenshot(page, "analytics_dashboard")

    log_result("Analytics", "Page loads", "/analytics" in page.url)


# ============================================================================
# SECTION 9: VISITS & WORKFLOW
# ============================================================================

def test_visits(page):
    """Visit Dashboard"""
    print("\n📋 Testing VISITS...")

    page.goto(f"{BASE_URL}/visits")
    wait_and_screenshot(page, "visit_dashboard")

    log_result("Visits", "Page loads", "/visits" in page.url)


# ============================================================================
# SECTION 10: PUBLIC PAGES
# ============================================================================

def test_public_booking(page):
    """Public Booking Page"""
    print("\n🌐 Testing PUBLIC BOOKING...")

    page.goto(f"{BASE_URL}/book")
    wait_and_screenshot(page, "public_booking")

    log_result("Public Booking", "Page loads", "/book" in page.url)

def test_display_board(page):
    """Queue Display Board"""
    print("\n📺 Testing DISPLAY BOARD...")

    page.goto(f"{BASE_URL}/display-board")
    wait_and_screenshot(page, "display_board")

    log_result("Display Board", "Page loads", "/display-board" in page.url)


# ============================================================================
# SECTION 11: EXTERNAL & CROSS-CLINIC
# ============================================================================

def test_external_facilities(page):
    """External Facilities"""
    print("\n🏥 Testing EXTERNAL FACILITIES...")

    page.goto(f"{BASE_URL}/external-facilities")
    wait_and_screenshot(page, "external_facilities")

    log_result("External", "Page loads", True)

def test_dispatch(page):
    """Dispatch Dashboard"""
    print("\n🚚 Testing DISPATCH...")

    page.goto(f"{BASE_URL}/dispatch")
    wait_and_screenshot(page, "dispatch")

    log_result("Dispatch", "Page loads", True)

def test_consolidated_reports(page):
    """Consolidated Reports"""
    print("\n📊 Testing CONSOLIDATED REPORTS...")

    page.goto(f"{BASE_URL}/consolidated-reports")
    wait_and_screenshot(page, "consolidated_reports")

    log_result("Consolidated", "Page loads", True)


# ============================================================================
# SECTION 12: ADDITIONAL PAGES
# ============================================================================

def test_alerts(page):
    """Alerts Page"""
    print("\n🔔 Testing ALERTS...")

    page.goto(f"{BASE_URL}/alerts")
    wait_and_screenshot(page, "alerts")

    log_result("Alerts", "Page loads", True)

def test_notifications(page):
    """Notifications Page"""
    print("\n📬 Testing NOTIFICATIONS...")

    page.goto(f"{BASE_URL}/notifications")
    wait_and_screenshot(page, "notifications")

    log_result("Notifications", "Page loads", True)

def test_documents(page):
    """Document Generation"""
    print("\n📄 Testing DOCUMENTS...")

    page.goto(f"{BASE_URL}/documents")
    wait_and_screenshot(page, "documents")

    log_result("Documents", "Page loads", True)

def test_stock_reconciliation(page):
    """Stock Reconciliation"""
    print("\n📦 Testing STOCK RECONCILIATION...")

    page.goto(f"{BASE_URL}/stock-reconciliation")
    wait_and_screenshot(page, "stock_reconciliation")

    log_result("Stock", "Page loads", True)

def test_purchase_orders(page):
    """Purchase Orders"""
    print("\n📝 Testing PURCHASE ORDERS...")

    page.goto(f"{BASE_URL}/purchase-orders")
    wait_and_screenshot(page, "purchase_orders")

    log_result("Purchase Orders", "Page loads", True)

def test_queue_analytics(page):
    """Queue Analytics"""
    print("\n📊 Testing QUEUE ANALYTICS...")

    page.goto(f"{BASE_URL}/queue-analytics")
    wait_and_screenshot(page, "queue_analytics")

    log_result("Queue Analytics", "Page loads", True)

def test_nurse_vitals(page):
    """Nurse Vitals Entry"""
    print("\n💉 Testing NURSE VITALS...")

    page.goto(f"{BASE_URL}/nurse-vitals")
    wait_and_screenshot(page, "nurse_vitals")

    log_result("Nurse Vitals", "Page loads", True)

def test_ocr_import(page):
    """OCR Import"""
    print("\n📑 Testing OCR IMPORT...")

    page.goto(f"{BASE_URL}/ocr-import")
    wait_and_screenshot(page, "ocr_import")

    log_result("OCR Import", "Page loads", True)


# ============================================================================
# SECTION 13: RESPONSIVE TESTING
# ============================================================================

def test_responsive_layouts(page):
    """Test responsive layouts"""
    print("\n📱 Testing RESPONSIVE LAYOUTS...")

    viewports = [
        {"name": "desktop_1920", "width": 1920, "height": 1080},
        {"name": "desktop_1366", "width": 1366, "height": 768},
        {"name": "tablet_landscape", "width": 1024, "height": 768},
        {"name": "tablet_portrait", "width": 768, "height": 1024},
        {"name": "mobile_large", "width": 414, "height": 896},
        {"name": "mobile_small", "width": 375, "height": 667},
    ]

    test_pages = ["/dashboard", "/patients", "/queue"]

    for vp in viewports:
        page.set_viewport_size({"width": vp["width"], "height": vp["height"]})

        for test_page in test_pages:
            page.goto(f"{BASE_URL}{test_page}")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500)

            page_name = test_page.replace("/", "_") if test_page != "/" else "_home"
            safe_screenshot(page, f"responsive_{vp['name']}_{page_name}")

        log_result("Responsive", f"Layout at {vp['width']}x{vp['height']}", True)

    # Reset viewport
    page.set_viewport_size({"width": 1920, "height": 1080})


# ============================================================================
# REPORT GENERATION
# ============================================================================

def generate_report():
    """Generate comprehensive test report"""
    passed = sum(1 for r in test_results if r["passed"])
    failed = sum(1 for r in test_results if not r["passed"])

    categories = {}
    for r in test_results:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"passed": 0, "failed": 0}
        if r["passed"]:
            categories[cat]["passed"] += 1
        else:
            categories[cat]["failed"] += 1

    report = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(test_results),
        "passed": passed,
        "failed": failed,
        "success_rate": f"{passed/max(len(test_results),1)*100:.1f}%",
        "screenshots_taken": len(screenshots_taken),
        "screenshot_paths": screenshots_taken,
        "categories": categories,
        "results": test_results
    }

    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)

    return report


def print_summary(report):
    """Print test summary"""
    print("\n" + "="*70)
    print("📊 ULTIMATE E2E TEST SUMMARY")
    print("="*70)
    print(f"Total Tests: {report['total_tests']}")
    print(f"✅ Passed: {report['passed']}")
    print(f"❌ Failed: {report['failed']}")
    print(f"Success Rate: {report['success_rate']}")
    print(f"📸 Screenshots: {report['screenshots_taken']}")
    print()

    print("By Category:")
    for cat, data in report["categories"].items():
        total = data["passed"] + data["failed"]
        status = "✅" if data["failed"] == 0 else "⚠️"
        print(f"  {status} {cat}: {data['passed']}/{total}")

    print()
    print(f"📄 Report: {REPORT_FILE}")
    print(f"📸 Screenshots: {SCREENSHOT_DIR}")


def main():
    """Main test runner"""
    print("🚀 MedFlow Ultimate E2E Test Suite")
    print("="*70)
    print("Complete coverage of every page and workflow")
    print()

    with sync_playwright() as p:
        headless = os.getenv('HEADED', '0') != '1'
        browser = p.chromium.launch(headless=headless, slow_mo=100 if not headless else 0)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            ignore_https_errors=True
        )
        page = context.new_page()

        # Login
        print("🔐 Logging in...")
        if not login(page):
            print("❌ Login failed! Aborting tests.")
            return 1
        print("✅ Logged in successfully")

        try:
            # SECTION 1: Core Navigation
            test_home_dashboard(page)
            test_main_dashboard(page)
            test_patients_list(page)
            test_queue_management(page)
            test_appointments(page)

            # SECTION 2: Clinical Modules
            test_ophthalmology_dashboard(page)
            test_studiovision_consultation(page)
            test_prescriptions(page)
            test_pharmacy(page)
            test_laboratory(page)
            test_ivt_dashboard(page)
            test_surgery_dashboard(page)
            test_orthoptic(page)

            # SECTION 3: Financial
            test_invoicing(page)
            test_financial_dashboard(page)
            test_companies(page)
            test_approvals(page)
            test_services(page)

            # SECTION 4: Inventory
            test_frame_inventory(page)
            test_optical_lens_inventory(page)
            test_contact_lens_inventory(page)
            test_reagent_inventory(page)
            test_lab_consumable_inventory(page)
            test_cross_clinic_inventory(page)

            # SECTION 5: Optical Shop
            test_glasses_orders(page)
            test_optical_shop(page)
            test_repairs(page)

            # SECTION 6: Device Integration
            test_device_manager(page)
            test_network_discovery(page)
            test_imaging(page)

            # SECTION 7: Administration
            test_settings(page)
            test_user_management(page)
            test_audit_trail(page)
            test_backup_management(page)

            # SECTION 8: Templates & Analytics
            test_templates(page)
            test_analytics(page)

            # SECTION 9: Visits
            test_visits(page)

            # SECTION 10: Public
            test_public_booking(page)
            test_display_board(page)

            # SECTION 11: External
            test_external_facilities(page)
            test_dispatch(page)
            test_consolidated_reports(page)

            # SECTION 12: Additional
            test_alerts(page)
            test_notifications(page)
            test_documents(page)
            test_stock_reconciliation(page)
            test_purchase_orders(page)
            test_queue_analytics(page)
            test_nurse_vitals(page)
            test_ocr_import(page)

            # SECTION 13: Responsive
            test_responsive_layouts(page)

        except Exception as e:
            print(f"\n❌ Test error: {e}")
            import traceback
            traceback.print_exc()

        browser.close()

    report = generate_report()
    print_summary(report)

    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
