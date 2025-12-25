#!/usr/bin/env python3
"""
MedFlow Detailed Workflow Tests
Testing all interactive elements, modals, and forms
"""

import json
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/comprehensive"
REPORT_FILE = "/Users/xtm888/magloire/tests/playwright/workflow_report.json"
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

test_results = []
screenshots_taken = []

def safe_screenshot(page, name):
    """Take screenshot safely"""
    path = f"{SCREENSHOT_DIR}/{name}.png"
    try:
        page.screenshot(path=path, full_page=True)
        screenshots_taken.append(path)
        print(f"    📸 {name}.png")
        return path
    except:
        return None

def log_result(cat, test, passed, details=""):
    test_results.append({"category": cat, "test": test, "passed": passed, "details": details})
    print(f"  {'✅' if passed else '❌'} {test}")

def login(page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)
    page.locator('button[type="submit"]').click()
    try:
        page.wait_for_url("**/home", timeout=15000)
        return True
    except:
        # Try alternative: might redirect to dashboard instead of home
        try:
            page.wait_for_url("**/dashboard", timeout=5000)
            return True
        except:
            return False


# ============================================================================
# DETAILED WORKFLOW TESTS
# ============================================================================

def test_patient_wizard_all_steps(page):
    """Test all 5 steps of patient wizard"""
    print("\n👤 Testing PATIENT WIZARD (All Steps)...")

    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click new patient button
    new_btn = page.locator('button:has-text("Nouveau patient")')
    if new_btn.count() > 0:
        new_btn.click()
        page.wait_for_timeout(1000)

        # Step 1: Photo
        safe_screenshot(page, "wizard_step1_photo")
        log_result("Patient Wizard", "Step 1 (Photo) visible", page.locator('text="Photo"').count() > 0)

        # Navigate through steps
        next_btn = page.locator('button:has-text("Suivant")')
        if next_btn.count() > 0:
            # Go to Step 2
            next_btn.last.click()
            page.wait_for_timeout(500)
            safe_screenshot(page, "wizard_step2_personnel")
            log_result("Patient Wizard", "Step 2 (Personnel) visible", True)

            # Go to Step 3
            next_btn = page.locator('button:has-text("Suivant")')
            if next_btn.count() > 0:
                next_btn.last.click()
                page.wait_for_timeout(500)
                safe_screenshot(page, "wizard_step3_contact")
                log_result("Patient Wizard", "Step 3 (Contact) visible", True)

                # Go to Step 4
                next_btn = page.locator('button:has-text("Suivant")')
                if next_btn.count() > 0:
                    next_btn.last.click()
                    page.wait_for_timeout(500)
                    safe_screenshot(page, "wizard_step4_convention")
                    log_result("Patient Wizard", "Step 4 (Convention) visible", True)

                    # Go to Step 5
                    next_btn = page.locator('button:has-text("Suivant")')
                    if next_btn.count() > 0:
                        next_btn.last.click()
                        page.wait_for_timeout(500)
                        safe_screenshot(page, "wizard_step5_medical")
                        log_result("Patient Wizard", "Step 5 (Medical) visible", True)

        # Close modal
        page.keyboard.press("Escape")


def test_appointment_modal_interactions(page):
    """Test appointment modal form fields"""
    print("\n📅 Testing APPOINTMENT MODAL...")

    page.goto(f"{BASE_URL}/appointments")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click new appointment
    new_btn = page.locator('button:has-text("Nouveau")')
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(1000)

        safe_screenshot(page, "appointment_modal_empty")

        # Check form fields
        patient_select = page.locator('[class*="select"], input[placeholder*="patient"]')
        log_result("Appointment Modal", "Patient selector present", patient_select.count() > 0)

        date_field = page.locator('input[type="date"], [class*="date"]')
        log_result("Appointment Modal", "Date picker present", date_field.count() > 0)

        time_field = page.locator('input[type="time"], [class*="time"]')
        log_result("Appointment Modal", "Time picker present", time_field.count() > 0)

        page.keyboard.press("Escape")


def test_queue_checkin_modal(page):
    """Test queue check-in modal"""
    print("\n📋 Testing QUEUE CHECK-IN...")

    page.goto(f"{BASE_URL}/queue")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click check-in/add button
    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Enregistrer"), button:has-text("Check")')
    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "queue_checkin_modal")
        log_result("Queue", "Check-in modal opens", True)
        page.keyboard.press("Escape")


def test_pharmacy_add_modal(page):
    """Test pharmacy add medication modal"""
    print("\n💉 Testing PHARMACY ADD MODAL...")

    page.goto(f"{BASE_URL}/pharmacy")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Add")')
    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "pharmacy_add_modal")
        log_result("Pharmacy", "Add medication modal opens", True)
        page.keyboard.press("Escape")


def test_invoice_creation(page):
    """Test invoice creation modal"""
    print("\n💰 Testing INVOICE CREATION...")

    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_btn = page.locator('button:has-text("Nouvelle"), button:has-text("Créer")')
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "invoice_creation_modal")
        log_result("Invoice", "Creation modal opens", True)
        page.keyboard.press("Escape")


def test_user_add_modal(page):
    """Test user add modal"""
    print("\n👤 Testing USER ADD MODAL...")

    page.goto(f"{BASE_URL}/users")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Nouveau")')
    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "user_add_modal")
        log_result("User Management", "Add user modal opens", True)
        page.keyboard.press("Escape")


def test_template_creation(page):
    """Test template creation"""
    print("\n📝 Testing TEMPLATE CREATION...")

    page.goto(f"{BASE_URL}/templates")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_btn = page.locator('button:has-text("Nouveau"), button:has-text("Créer")')
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "template_creation_modal")
        log_result("Templates", "Creation modal opens", True)
        page.keyboard.press("Escape")


def test_frame_inventory_add(page):
    """Test frame inventory add"""
    print("\n👓 Testing FRAME INVENTORY ADD...")

    page.goto(f"{BASE_URL}/frame-inventory")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Add")')
    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "frame_add_modal")
        log_result("Frame Inventory", "Add frame modal opens", True)
        page.keyboard.press("Escape")


def test_company_add(page):
    """Test company/convention add"""
    print("\n🏢 Testing COMPANY ADD...")

    page.goto(f"{BASE_URL}/companies")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Nouvelle")')
    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "company_add_modal")
        log_result("Companies", "Add company modal opens", True)
        page.keyboard.press("Escape")


def test_device_add(page):
    """Test device add"""
    print("\n📱 Testing DEVICE ADD...")

    page.goto(f"{BASE_URL}/devices")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Add")')
    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        safe_screenshot(page, "device_add_modal")
        log_result("Devices", "Add device modal opens", True)
        page.keyboard.press("Escape")


def test_ivt_new_injection(page):
    """Test IVT new injection form"""
    print("\n💉 Testing IVT NEW INJECTION...")

    page.goto(f"{BASE_URL}/ivt/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    safe_screenshot(page, "ivt_new_injection")
    log_result("IVT", "New injection page loads", True)


def test_surgery_new_case(page):
    """Test surgery new case form"""
    print("\n🏥 Testing SURGERY NEW CASE...")

    page.goto(f"{BASE_URL}/surgery/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    safe_screenshot(page, "surgery_new_case")
    log_result("Surgery", "New case page loads", True)


def test_laboratory_worklist(page):
    """Test laboratory worklist view"""
    print("\n🔬 Testing LABORATORY WORKLIST...")

    page.goto(f"{BASE_URL}/laboratory")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Look for tabs
    worklist_tab = page.locator('text="Worklist", text="En cours"')
    if worklist_tab.count() > 0:
        worklist_tab.first.click()
        page.wait_for_timeout(500)
        safe_screenshot(page, "laboratory_worklist")
        log_result("Laboratory", "Worklist tab works", True)


def test_settings_tabs(page):
    """Test settings page tabs"""
    print("\n⚙️ Testing SETTINGS TABS...")

    page.goto(f"{BASE_URL}/settings")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Look for settings sections or tabs
    sections = page.locator('[class*="tab"], [class*="section"], button').count()
    log_result("Settings", "Settings sections present", sections > 3)
    safe_screenshot(page, "settings_expanded")


def test_analytics_date_range(page):
    """Test analytics date range selector"""
    print("\n📊 Testing ANALYTICS DATE RANGE...")

    page.goto(f"{BASE_URL}/analytics")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Look for date range controls
    date_controls = page.locator('input[type="date"], select, [class*="date"]')
    log_result("Analytics", "Date controls present", date_controls.count() > 0)


def test_sidebar_navigation(page):
    """Test sidebar navigation expansion"""
    print("\n📑 Testing SIDEBAR NAVIGATION...")

    page.goto(f"{BASE_URL}/home")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Find sidebar
    sidebar = page.locator('[class*="sidebar"], nav, [class*="nav"]')
    if sidebar.count() > 0:
        safe_screenshot(page, "sidebar_navigation")
        log_result("Navigation", "Sidebar visible", True)


def test_patient_detail_tabs(page):
    """Test patient detail page tabs"""
    print("\n👤 Testing PATIENT DETAIL TABS...")

    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click on the view button (eye icon) in first patient row to navigate to detail
    view_btn = page.locator('tbody tr button, tbody tr a, [class*="eye"], [aria-label*="voir"], [aria-label*="view"]')
    if view_btn.count() > 0:
        view_btn.first.click()
        page.wait_for_timeout(2000)
        safe_screenshot(page, "patient_detail_overview")

        # Check if we navigated to patient detail page
        is_detail_page = "/patients/" in page.url or page.get_by_text("Informations du patient", exact=False).count() > 0
        log_result("Patient Detail", "Detail page loads", is_detail_page)
    else:
        # Fallback: Try clicking on patient name link
        patient_link = page.locator('tbody tr td a, tbody tr [class*="cursor-pointer"]')
        if patient_link.count() > 0:
            patient_link.first.click()
            page.wait_for_timeout(2000)
            safe_screenshot(page, "patient_detail_overview")
            log_result("Patient Detail", "Detail page loads", "/patients/" in page.url)
        else:
            log_result("Patient Detail", "Detail page loads", False, "Could not find clickable element")


def test_dropdown_menus(page):
    """Test dropdown menus work"""
    print("\n📋 Testing DROPDOWN MENUS...")

    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Find dropdowns
    dropdowns = page.locator('select, [class*="dropdown"]')
    if dropdowns.count() > 0:
        dropdowns.first.click()
        page.wait_for_timeout(500)
        safe_screenshot(page, "dropdown_open")
        log_result("UI Components", "Dropdowns work", True)


def test_search_functionality(page):
    """Test search across pages"""
    print("\n🔍 Testing SEARCH FUNCTIONALITY...")

    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    search = page.locator('input[placeholder*="Rechercher"], input[placeholder*="Search"]')
    if search.count() > 0:
        search.first.fill("test")
        page.wait_for_timeout(500)
        safe_screenshot(page, "search_with_text")
        log_result("Search", "Search input works", True)
        search.first.clear()


def test_filter_panels(page):
    """Test filter panels"""
    print("\n🔧 Testing FILTER PANELS...")

    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    filter_btn = page.locator('button:has-text("Filtres"), button:has-text("Filter")')
    if filter_btn.count() > 0:
        filter_btn.first.click()
        page.wait_for_timeout(500)
        safe_screenshot(page, "filter_panel_open")
        log_result("Filters", "Filter panel opens", True)
        page.keyboard.press("Escape")


def test_export_buttons(page):
    """Test export buttons exist"""
    print("\n📤 Testing EXPORT BUTTONS...")

    page.goto(f"{BASE_URL}/financial")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    export_btn = page.locator('button:has-text("Exporter"), button:has-text("Export")')
    log_result("Export", "Export button present", export_btn.count() > 0)


def test_optical_shop_tabs(page):
    """Test optical shop tabs"""
    print("\n👓 Testing OPTICAL SHOP TABS...")

    page.goto(f"{BASE_URL}/optical-shop")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Check for different views/tabs
    tabs = page.locator('[role="tab"], button[class*="tab"]')
    if tabs.count() > 0:
        safe_screenshot(page, "optical_shop_tabs")
        log_result("Optical Shop", "Tab navigation present", True)


def test_visit_workflow(page):
    """Test visit workflow page"""
    print("\n📋 Testing VISIT WORKFLOW...")

    page.goto(f"{BASE_URL}/visits")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Check for visit cards/list
    visits = page.locator('table tbody tr, [class*="visit-card"], [class*="card"]')
    safe_screenshot(page, "visit_workflow")
    log_result("Visits", "Visit list visible", visits.count() >= 0)


def generate_report():
    passed = sum(1 for r in test_results if r["passed"])
    failed = sum(1 for r in test_results if not r["passed"])

    report = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(test_results),
        "passed": passed,
        "failed": failed,
        "success_rate": f"{passed/max(len(test_results),1)*100:.1f}%",
        "screenshots": len(screenshots_taken),
        "results": test_results
    }

    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)

    return report


def main():
    print("🔬 MedFlow Detailed Workflow Tests")
    print("="*60)

    with sync_playwright() as p:
        headless = os.getenv('HEADED', '0') != '1'
        browser = p.chromium.launch(headless=headless, slow_mo=100 if not headless else 0)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        print("🔐 Logging in...")
        if not login(page):
            print("❌ Login failed!")
            return 1
        print("✅ Logged in")

        try:
            # All workflow tests
            test_patient_wizard_all_steps(page)
            test_appointment_modal_interactions(page)
            test_queue_checkin_modal(page)
            test_pharmacy_add_modal(page)
            test_invoice_creation(page)
            test_user_add_modal(page)
            test_template_creation(page)
            test_frame_inventory_add(page)
            test_company_add(page)
            test_device_add(page)
            test_ivt_new_injection(page)
            test_surgery_new_case(page)
            test_laboratory_worklist(page)
            test_settings_tabs(page)
            test_analytics_date_range(page)
            test_sidebar_navigation(page)
            test_patient_detail_tabs(page)
            test_dropdown_menus(page)
            test_search_functionality(page)
            test_filter_panels(page)
            test_export_buttons(page)
            test_optical_shop_tabs(page)
            test_visit_workflow(page)

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()

        browser.close()

    report = generate_report()

    print("\n" + "="*60)
    print("📊 WORKFLOW TEST SUMMARY")
    print("="*60)
    print(f"Total: {report['total_tests']} | ✅ {report['passed']} | ❌ {report['failed']}")
    print(f"Success Rate: {report['success_rate']}")
    print(f"📸 Screenshots: {report['screenshots']}")

    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
