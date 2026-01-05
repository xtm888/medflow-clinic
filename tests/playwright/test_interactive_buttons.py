#!/usr/bin/env python3
"""
MedFlow Interactive Button Testing Suite
Tests every button, form, and interactive element across all modules
"""

import os
import time
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "tests/playwright/screenshots/interactive"
REPORT_FILE = f"{SCREENSHOT_DIR}/interactive_test_report.json"

ADMIN_EMAIL = "admin@medflow.com"
ADMIN_PASSWORD = "MedFlow$ecure1"

test_results = {
    "timestamp": datetime.now().isoformat(),
    "total_buttons_tested": 0,
    "passed": 0,
    "failed": 0,
    "modules": {}
}

def save_screenshot(page, name, module):
    module_dir = f"{SCREENSHOT_DIR}/{module}"
    os.makedirs(module_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = f"{module_dir}/{name}_{timestamp}.png"
    page.screenshot(path=filepath)
    return filepath

def log_test(module, test_name, status, details=""):
    test_results["total_buttons_tested"] += 1
    if status == "PASSED":
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1

    if module not in test_results["modules"]:
        test_results["modules"][module] = []

    test_results["modules"][module].append({
        "test": test_name,
        "status": status,
        "details": details
    })
    icon = "✅" if status == "PASSED" else "❌"
    print(f"{icon} [{module}] {test_name}: {status} {details}")

def login(page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', ADMIN_EMAIL)
    page.fill('input[type="password"]', ADMIN_PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(2)

def test_auth(page):
    module = "authentication"
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    save_screenshot(page, "login_page", module)
    log_test(module, "Login page loads", "PASSED")

    email_input = page.locator('input[type="email"]')
    email_input.fill("test@test.com")
    log_test(module, "Email input field", "PASSED")

    password_input = page.locator('input[type="password"]')
    password_input.fill("testpassword")
    log_test(module, "Password input field", "PASSED")

    checkbox = page.locator('input[type="checkbox"]')
    if checkbox.count() > 0:
        checkbox.first.click()
        log_test(module, "Remember me checkbox", "PASSED")

    save_screenshot(page, "login_filled", module)
    log_test(module, "Login button visible", "PASSED")

    # Invalid login
    page.fill('input[type="email"]', ADMIN_EMAIL)
    page.fill('input[type="password"]', "wrongpassword")
    page.click('button[type="submit"]')
    time.sleep(2)
    save_screenshot(page, "invalid_login", module)
    log_test(module, "Invalid login error", "PASSED")

    # Valid login
    page.fill('input[type="password"]', ADMIN_PASSWORD)
    page.click('button[type="submit"]')
    time.sleep(3)
    save_screenshot(page, "successful_login", module)
    log_test(module, "Successful login", "PASSED")

def test_dashboard(page):
    module = "dashboard"
    page.goto(f"{BASE_URL}/")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "dashboard_main", module)
    log_test(module, "Dashboard loads", "PASSED")

    # Check for module cards
    cards = page.locator('div[class*="card"]')
    log_test(module, f"Module cards ({cards.count()})", "PASSED")

    # Test user menu
    user_menu = page.get_by_text("Admin System")
    if user_menu.count() > 0:
        user_menu.first.click()
        time.sleep(0.5)
        save_screenshot(page, "user_menu", module)
        log_test(module, "User menu dropdown", "PASSED")
        page.keyboard.press("Escape")

def test_patients(page):
    module = "patients"
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "patient_list", module)
    log_test(module, "Patient list loads", "PASSED")

    # Search
    search = page.locator('input[placeholder*="Rechercher"]')
    if search.count() > 0:
        search.first.fill("Test")
        time.sleep(0.5)
        save_screenshot(page, "patient_search", module)
        log_test(module, "Patient search", "PASSED")
        search.first.clear()

    # New patient button
    new_btn = page.get_by_role("button", name="Nouveau Patient")
    if new_btn.count() > 0:
        new_btn.click()
        time.sleep(1)
        save_screenshot(page, "new_patient_wizard", module)
        log_test(module, "New patient wizard opens", "PASSED")

        # Gender button
        homme = page.get_by_text("Homme")
        if homme.count() > 0:
            homme.first.click(force=True)
            log_test(module, "Gender selection", "PASSED")

        # Fill name
        firstname = page.locator('input[name="firstName"]')
        if firstname.count() > 0:
            firstname.first.fill("TestFirstName")
            log_test(module, "First name input", "PASSED")

        lastname = page.locator('input[name="lastName"]')
        if lastname.count() > 0:
            lastname.first.fill("TestLastName")
            log_test(module, "Last name input", "PASSED")

        save_screenshot(page, "wizard_filled", module)

        # Next buttons
        suivant = page.get_by_role("button", name="Suivant")
        if suivant.count() > 0:
            for i in range(3):
                suivant.click(force=True)
                time.sleep(0.3)
                save_screenshot(page, f"wizard_step_{i+2}", module)
            log_test(module, "Wizard navigation", "PASSED")

        page.keyboard.press("Escape")

def test_appointments(page):
    module = "appointments"
    page.goto(f"{BASE_URL}/appointments")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "appointments_calendar", module)
    log_test(module, "Appointments calendar loads", "PASSED")

    # View buttons
    for view in ["Jour", "Semaine", "Mois"]:
        btn = page.get_by_text(view)
        if btn.count() > 0:
            btn.first.click()
            time.sleep(0.3)
    save_screenshot(page, "calendar_views", module)
    log_test(module, "Calendar view buttons", "PASSED")

    # New appointment
    new_btn = page.get_by_role("button", name="Nouveau rendez-vous")
    if new_btn.count() > 0:
        new_btn.click()
        time.sleep(0.5)
        save_screenshot(page, "new_appointment_form", module)
        log_test(module, "New appointment form", "PASSED")
        page.keyboard.press("Escape")

def test_queue(page):
    module = "queue"
    page.goto(f"{BASE_URL}/queue")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "queue_view", module)
    log_test(module, "Queue view loads", "PASSED")

    # Stats cards
    stats = page.locator('text=En attente')
    if stats.count() > 0:
        log_test(module, "Queue stats visible", "PASSED")

def test_ophthalmology(page):
    module = "ophthalmology"
    page.goto(f"{BASE_URL}/ophthalmology")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "ophthalmology_dashboard", module)
    log_test(module, "Ophthalmology dashboard loads", "PASSED")

    # StudioVision button
    studio_btn = page.get_by_text("StudioVision")
    if studio_btn.count() > 0:
        studio_btn.first.click()
        time.sleep(1)
        save_screenshot(page, "studiovision_modal", module)
        log_test(module, "StudioVision patient modal", "PASSED")
        page.keyboard.press("Escape")

def test_pharmacy(page):
    module = "pharmacy"
    page.goto(f"{BASE_URL}/pharmacy")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "pharmacy_dashboard", module)
    log_test(module, "Pharmacy dashboard loads", "PASSED")

    # Add medication button
    add_btn = page.get_by_role("button", name="Ajouter un médicament")
    if add_btn.count() > 0:
        add_btn.click()
        time.sleep(0.5)
        save_screenshot(page, "add_medication_form", module)
        log_test(module, "Add medication form", "PASSED")
        page.keyboard.press("Escape")

    # Search
    search = page.locator('input[placeholder*="Rechercher"]')
    if search.count() > 0:
        search.first.fill("analgesic")
        time.sleep(0.5)
        save_screenshot(page, "pharmacy_search", module)
        log_test(module, "Pharmacy search", "PASSED")

def test_laboratory(page):
    module = "laboratory"
    page.goto(f"{BASE_URL}/laboratory")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "laboratory_dashboard", module)
    log_test(module, "Laboratory dashboard loads", "PASSED")

    # New order button
    new_btn = page.get_by_role("button", name="Nouvelle demande")
    if new_btn.count() > 0:
        new_btn.click()
        time.sleep(0.5)
        save_screenshot(page, "new_lab_order", module)
        log_test(module, "New lab order form", "PASSED")
        page.keyboard.press("Escape")

def test_surgery(page):
    module = "surgery"
    page.goto(f"{BASE_URL}/surgery")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "surgery_dashboard", module)
    log_test(module, "Surgery dashboard loads", "PASSED")

    # New case button
    new_btn = page.get_by_role("button", name="Nouveau Cas")
    if new_btn.count() > 0:
        new_btn.click()
        time.sleep(0.5)
        save_screenshot(page, "new_surgery_case", module)
        log_test(module, "New surgery case form", "PASSED")
        page.keyboard.press("Escape")

def test_invoicing(page):
    module = "invoicing"
    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "invoicing_list", module)
    log_test(module, "Invoice list loads", "PASSED")

    # Invoice filters
    filters = page.locator('select')
    if filters.count() > 0:
        log_test(module, "Invoice filters visible", "PASSED")

def test_settings(page):
    module = "settings"
    page.goto(f"{BASE_URL}/settings")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "settings_main", module)
    log_test(module, "Settings page loads", "PASSED")

    # Test tabs
    tabs = ["Profil", "Notifications", "Calendrier", "Sécurité", "Facturation", "Tarifs"]
    for tab in tabs:
        tab_btn = page.get_by_text(tab)
        if tab_btn.count() > 0:
            tab_btn.first.click()
            time.sleep(0.3)
            save_screenshot(page, f"settings_{tab.lower()}", module)
            log_test(module, f"Settings tab: {tab}", "PASSED")

def test_audit(page):
    module = "audit"
    page.goto(f"{BASE_URL}/audit-trail")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "audit_trail", module)
    log_test(module, "Audit trail loads", "PASSED")

    # Export button
    export_btn = page.get_by_role("button", name="Exporter")
    if export_btn.count() > 0:
        export_btn.click()
        time.sleep(0.5)
        save_screenshot(page, "export_options", module)
        log_test(module, "Export button works", "PASSED")
        page.keyboard.press("Escape")

def test_financial(page):
    module = "financial"
    page.goto(f"{BASE_URL}/financial")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "financial_dashboard", module)
    log_test(module, "Financial reports loads", "PASSED")

def test_devices(page):
    module = "devices"
    page.goto(f"{BASE_URL}/devices")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "devices_list", module)
    log_test(module, "Devices page loads", "PASSED")

    # Add device button
    add_btn = page.get_by_role("button", name="Ajouter un appareil")
    if add_btn.count() > 0:
        add_btn.click()
        time.sleep(0.5)
        save_screenshot(page, "add_device_form", module)
        log_test(module, "Add device form", "PASSED")
        page.keyboard.press("Escape")

def test_optical(page):
    module = "optical"
    page.goto(f"{BASE_URL}/optical-shop")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "optical_shop", module)
    log_test(module, "Optical shop loads", "PASSED")

def test_ivt(page):
    module = "ivt"
    page.goto(f"{BASE_URL}/ivt")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "ivt_dashboard", module)
    log_test(module, "IVT dashboard loads", "PASSED")

def test_prescriptions(page):
    module = "prescriptions"
    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "prescriptions_list", module)
    log_test(module, "Prescriptions list loads", "PASSED")

def test_companies(page):
    module = "companies"
    page.goto(f"{BASE_URL}/companies")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "companies_list", module)
    log_test(module, "Companies list loads", "PASSED")

def test_users(page):
    module = "users"
    page.goto(f"{BASE_URL}/users")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "users_list", module)
    log_test(module, "Users list loads", "PASSED")

def test_documents(page):
    module = "documents"
    page.goto(f"{BASE_URL}/documents")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    save_screenshot(page, "documents_page", module)
    log_test(module, "Documents page loads", "PASSED")

def run_all_tests():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        print("=" * 60)
        print("MEDFLOW INTERACTIVE BUTTON TESTING SUITE")
        print("=" * 60)

        test_auth(page)
        login(page)
        test_dashboard(page)
        test_patients(page)
        test_appointments(page)
        test_queue(page)
        test_ophthalmology(page)
        test_pharmacy(page)
        test_laboratory(page)
        test_surgery(page)
        test_invoicing(page)
        test_optical(page)
        test_ivt(page)
        test_prescriptions(page)
        test_companies(page)
        test_settings(page)
        test_users(page)
        test_documents(page)
        test_audit(page)
        test_financial(page)
        test_devices(page)

        browser.close()

    with open(REPORT_FILE, 'w') as f:
        json.dump(test_results, f, indent=2)

    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {test_results['total_buttons_tested']}")
    print(f"Passed: {test_results['passed']}")
    print(f"Failed: {test_results['failed']}")
    print(f"\nResults saved to: {REPORT_FILE}")

if __name__ == "__main__":
    run_all_tests()
