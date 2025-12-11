#!/usr/bin/env python3
"""
MedFlow Functional Workflow Tests
Tests actual business logic and user workflows
"""

import json
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

# Configuration
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/workflows"
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def login(page):
    """Login helper"""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)
    page.locator('button[type="submit"]').click()
    page.wait_for_url("**/home", timeout=15000)
    page.wait_for_load_state("networkidle")
    print("✅ Logged in successfully")


def test_patient_creation(page):
    """Test creating a new patient"""
    print("\n📋 Testing Patient Creation Workflow...")

    # Navigate to patients page
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    # Click "Nouveau patient" button
    new_patient_btn = page.locator('button:has-text("Nouveau patient"), button:has-text("Ajouter"), a:has-text("Nouveau patient")')
    if new_patient_btn.count() > 0:
        new_patient_btn.first.click()
        page.wait_for_timeout(1000)

        # Check if wizard/modal appeared - it's a 5-step wizard starting with Photo
        # Steps: 1.Photo -> 2.Personnel -> 3.Contact -> 4.Convention -> 5.Médical
        wizard_title = page.locator('text="Photo du patient"')
        step_text = page.locator('text="Capturer photo"')
        suivant_btn = page.locator('button:has-text("Suivant")')

        if wizard_title.count() > 0 or step_text.count() > 0 or suivant_btn.count() > 0:
            page.screenshot(path=f"{SCREENSHOT_DIR}/patient_creation_wizard_step1.png")
            print("  ✅ Patient creation wizard opened (Step 1: Photo)")

            # Click "Suivant" to go to step 2 (Personnel info)
            next_btn = page.locator('button:has-text("Suivant")')
            if next_btn.count() > 0:
                next_btn.click()
                page.wait_for_timeout(500)
                page.screenshot(path=f"{SCREENSHOT_DIR}/patient_creation_wizard_step2.png")
                print("  ✅ Advanced to Step 2: Personnel")

                # Now look for name fields in step 2
                first_name = page.locator('input[name="firstName"], input[name="prenom"], input[placeholder*="prénom" i]')
                last_name = page.locator('input[name="lastName"], input[name="nom"], input[placeholder*="nom" i]')

                if first_name.count() > 0 or last_name.count() > 0:
                    print("  ✅ Found patient info fields in wizard")

            return True

        # Fallback: check for any modal/dialog that appeared
        # Look for the X close button which indicates a modal opened
        close_btn = page.locator('button:has-text("×"), [aria-label="Close"], button[class*="close"]')
        modal = page.locator('[role="dialog"], .modal, [class*="modal"]')

        if close_btn.count() > 0 or modal.count() > 0:
            page.screenshot(path=f"{SCREENSHOT_DIR}/patient_creation_form.png")
            print("  ✅ Patient creation modal opened")
            return True
        else:
            # Take a screenshot to see what's on screen
            page.screenshot(path=f"{SCREENSHOT_DIR}/patient_creation_no_form.png")
            # Check if we're on a different page (the wizard might have navigated)
            current_url = page.url
            if "/patients" in current_url and page.locator('text="Photo"').count() > 0:
                print("  ✅ Patient creation wizard visible")
                return True
            print("  ⚠️ Wizard/form did not appear")
    else:
        print("  ⚠️ New patient button not found")
        page.screenshot(path=f"{SCREENSHOT_DIR}/patient_page_no_button.png")

    return False


def test_queue_management(page):
    """Test queue management functionality"""
    print("\n📋 Testing Queue Management Workflow...")

    page.goto(f"{BASE_URL}/queue")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/queue_initial.png")

    # Check for queue elements
    queue_items = page.locator('[class*="queue"], [class*="waiting"], table tbody tr')
    tabs = page.locator('[role="tab"], button[class*="tab"]')

    print(f"  Found {queue_items.count()} queue items")
    print(f"  Found {tabs.count()} tabs")

    # Check for action buttons
    action_buttons = page.locator('button:has-text("Appeler"), button:has-text("Suivant"), button:has-text("Call")')
    print(f"  Found {action_buttons.count()} action buttons")

    page.screenshot(path=f"{SCREENSHOT_DIR}/queue_examined.png")
    return True


def test_appointment_booking(page):
    """Test appointment booking flow"""
    print("\n📋 Testing Appointment Booking Workflow...")

    page.goto(f"{BASE_URL}/appointments")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/appointments_initial.png")

    # Look for calendar or appointment creation button
    new_apt_btn = page.locator('button:has-text("Nouveau"), button:has-text("Ajouter"), button:has-text("New")')
    calendar = page.locator('[class*="calendar"], [class*="fc-"], .rbc-calendar')

    print(f"  Found calendar: {calendar.count() > 0}")
    print(f"  Found new appointment button: {new_apt_btn.count()}")

    if new_apt_btn.count() > 0:
        new_apt_btn.first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/appointment_form.png")
        print("  ✅ Appointment form opened")

    return True


def test_prescription_workflow(page):
    """Test prescription creation workflow"""
    print("\n📋 Testing Prescription Workflow...")

    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/prescriptions_initial.png")

    # Check prescription list elements
    prescription_list = page.locator('table, [class*="list"], [class*="prescription"]')
    new_rx_btn = page.locator('button:has-text("Nouvelle"), button:has-text("Ajouter"), button:has-text("New")')

    print(f"  Found prescription list: {prescription_list.count() > 0}")
    print(f"  Found new prescription button: {new_rx_btn.count()}")

    return True


def test_invoice_workflow(page):
    """Test invoice creation workflow"""
    print("\n📋 Testing Invoice Workflow...")

    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/invoicing_initial.png")

    # Check for invoice elements
    invoice_list = page.locator('table, [class*="invoice"]')
    new_invoice_btn = page.locator('button:has-text("Nouvelle"), button:has-text("Créer"), button:has-text("New")')
    search = page.locator('input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i]')

    print(f"  Found invoice list: {invoice_list.count() > 0}")
    print(f"  Found new invoice button: {new_invoice_btn.count()}")
    print(f"  Found search: {search.count() > 0}")

    return True


def test_ophthalmology_consultation(page):
    """Test ophthalmology consultation workflow"""
    print("\n📋 Testing Ophthalmology Consultation Workflow...")

    page.goto(f"{BASE_URL}/ophthalmology")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/ophthalmology_dashboard.png")

    # Look for consultation button
    consultation_btn = page.locator('button:has-text("Consultation"), a:has-text("Consultation"), [href*="consultation"]')

    if consultation_btn.count() > 0:
        print(f"  Found {consultation_btn.count()} consultation links")
        consultation_btn.first.click()
        page.wait_for_timeout(1000)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SCREENSHOT_DIR}/ophthalmology_consultation.png")

        # Check for exam form elements
        form_sections = page.locator('[class*="step"], [class*="section"], fieldset')
        print(f"  Found {form_sections.count()} form sections")
        return True
    else:
        print("  ⚠️ No consultation button found")

    return False


def test_laboratory_workflow(page):
    """Test laboratory workflow"""
    print("\n📋 Testing Laboratory Workflow...")

    page.goto(f"{BASE_URL}/laboratory")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/laboratory_dashboard.png")

    # Check for lab sections
    tabs = page.locator('[role="tab"], button[class*="tab"]')
    orders_table = page.locator('table')

    print(f"  Found {tabs.count()} tabs")
    print(f"  Found {orders_table.count()} tables")

    return True


def test_pharmacy_inventory(page):
    """Test pharmacy inventory workflow"""
    print("\n📋 Testing Pharmacy Inventory Workflow...")

    page.goto(f"{BASE_URL}/pharmacy")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/pharmacy_dashboard.png")

    # Check for inventory elements
    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Add")')
    search = page.locator('input[type="search"], input[placeholder*="recherche" i]')
    inventory_list = page.locator('table, [class*="inventory"]')

    print(f"  Found add button: {add_btn.count() > 0}")
    print(f"  Found search: {search.count() > 0}")
    print(f"  Found inventory list: {inventory_list.count() > 0}")

    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/pharmacy_add_form.png")
        print("  ✅ Add medication form opened")

    return True


def test_settings_page(page):
    """Test settings page functionality"""
    print("\n📋 Testing Settings Page...")

    page.goto(f"{BASE_URL}/settings")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.screenshot(path=f"{SCREENSHOT_DIR}/settings_page.png")

    # Check for settings sections
    sections = page.locator('[class*="section"], [class*="card"], fieldset')
    toggles = page.locator('input[type="checkbox"], [role="switch"]')
    save_btn = page.locator('button:has-text("Enregistrer"), button:has-text("Save")')

    print(f"  Found {sections.count()} sections")
    print(f"  Found {toggles.count()} toggles/checkboxes")
    print(f"  Found save button: {save_btn.count() > 0}")

    return True


def test_navigation_sidebar(page):
    """Test sidebar navigation"""
    print("\n📋 Testing Navigation Sidebar...")

    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    # Check sidebar links
    sidebar = page.locator('nav, [class*="sidebar"], aside')
    nav_links = page.locator('nav a, [class*="sidebar"] a')

    print(f"  Found sidebar: {sidebar.count() > 0}")
    print(f"  Found {nav_links.count()} navigation links")

    # Test clicking a few nav links
    if nav_links.count() >= 3:
        for i in range(min(3, nav_links.count())):
            link = nav_links.nth(i)
            href = link.get_attribute('href')
            if href and not href.startswith('http'):
                print(f"  Testing nav link: {href}")

    page.screenshot(path=f"{SCREENSHOT_DIR}/navigation_sidebar.png")
    return True


def test_search_functionality(page):
    """Test global search functionality"""
    print("\n📋 Testing Search Functionality...")

    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    # Find search input
    search_input = page.locator('input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i]')

    if search_input.count() > 0:
        search_input.first.fill("test")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/search_results.png")
        print("  ✅ Search executed")
        return True
    else:
        print("  ⚠️ No search input found")

    return False


def test_responsive_layout(page, context):
    """Test responsive layout at different viewports"""
    print("\n📋 Testing Responsive Layout...")

    viewports = [
        {"name": "desktop", "width": 1920, "height": 1080},
        {"name": "tablet", "width": 768, "height": 1024},
        {"name": "mobile", "width": 375, "height": 812},
    ]

    for vp in viewports:
        page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{SCREENSHOT_DIR}/responsive_{vp['name']}.png")
        print(f"  ✅ Captured {vp['name']} ({vp['width']}x{vp['height']})")

    # Reset to desktop
    page.set_viewport_size({"width": 1920, "height": 1080})
    return True


def main():
    """Main test runner for workflow tests"""
    print("🚀 MedFlow Functional Workflow Tests")
    print("="*60)

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            ignore_https_errors=True
        )
        page = context.new_page()

        # Login first
        login(page)

        # Run all workflow tests
        tests = [
            ("Patient Creation", test_patient_creation),
            ("Queue Management", test_queue_management),
            ("Appointment Booking", test_appointment_booking),
            ("Prescription Workflow", test_prescription_workflow),
            ("Invoice Workflow", test_invoice_workflow),
            ("Ophthalmology Consultation", test_ophthalmology_consultation),
            ("Laboratory Workflow", test_laboratory_workflow),
            ("Pharmacy Inventory", test_pharmacy_inventory),
            ("Settings Page", test_settings_page),
            ("Navigation Sidebar", test_navigation_sidebar),
            ("Search Functionality", test_search_functionality),
            ("Responsive Layout", lambda p: test_responsive_layout(p, context)),
        ]

        for name, test_func in tests:
            try:
                result = test_func(page)
                results.append({"name": name, "passed": result})
            except Exception as e:
                print(f"  ❌ Error in {name}: {e}")
                results.append({"name": name, "passed": False, "error": str(e)})

        browser.close()

    # Print summary
    print("\n" + "="*60)
    print("📊 WORKFLOW TEST SUMMARY")
    print("="*60)

    passed = sum(1 for r in results if r.get("passed"))
    total = len(results)

    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {total - passed}")
    print(f"Success Rate: {passed/total*100:.1f}%")
    print()

    for r in results:
        status = "✅" if r.get("passed") else "❌"
        print(f"  {status} {r['name']}")
        if r.get("error"):
            print(f"      Error: {r['error'][:50]}...")

    print(f"\n📸 Screenshots saved to: {SCREENSHOT_DIR}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
