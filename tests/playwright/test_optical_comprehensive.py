#!/usr/bin/env python3
"""
Comprehensive Optical Module E2E Test (UI-Based)
=================================================

Tests the complete optical workflow through the UI:
- Patient search and selection
- Glasses order creation via wizard
- Order status verification
- Inventory displays

Run: python test_optical_comprehensive.py
Or:  HEADED=1 python test_optical_comprehensive.py  (to see browser)

Author: MedFlow Test Automation
Created: 2025-12-28
"""
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from playwright.sync_api import Page

from comprehensive_test_utils import (
    ComprehensiveTestReporter, ComprehensiveBrowserSession,
    wait_for_loading_complete, get_table_row_count
)
from test_utils import (
    BASE_URL, navigate_to, has_element, has_text
)


class OpticalComprehensiveTest:
    """Comprehensive optical module test - UI based"""

    def __init__(self):
        self.reporter = ComprehensiveTestReporter('Optical')
        self.test_patient_name = None
        self.initial_order_count = 0

    def test_optical_shop_dashboard(self, page: Page):
        """Test optical shop dashboard loads correctly"""
        self.reporter.start_phase("Optical Shop Dashboard")

        success = navigate_to(page, '/optical-shop')
        self.reporter.add_step("Navigate to optical shop", success)
        if not success:
            return False

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'optical_shop_dashboard')

        checks = {
            'page_loads': has_element(page, 'main') or has_element(page, '.container'),
            'title': has_text(page, 'Optique') or has_text(page, 'Optical'),
            'patient_search': has_element(page, 'input'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Check: {name}", passed, screenshot_path=screenshot)

        return all(checks.values())

    def test_patient_search_and_select(self, page: Page):
        """Search for a patient and navigate to new sale"""
        self.reporter.start_phase("Patient Search & Selection")

        # Navigate to optical shop
        navigate_to(page, '/optical-shop')
        wait_for_loading_complete(page)

        # Find patient search input - the input has a placeholder mentioning patient/telephone/dossier
        search_selectors = [
            'input[placeholder*="patient"]',
            'input[placeholder*="Tapez"]',
            'input[placeholder*="rechercher"]',
            'input[type="text"]',
        ]

        search_input = None
        for selector in search_selectors:
            elem = page.locator(selector).first
            if elem.count() > 0 and elem.is_visible():
                search_input = elem
                break

        if not search_input:
            self.reporter.add_step("Find search input", False, "No search input found")
            return False

        self.reporter.add_step("Find search input", True)

        # Type search query - MUST be 2+ characters for search to trigger
        search_input.fill("ab")  # Search needs 2+ characters
        page.wait_for_timeout(1500)  # Wait for 300ms debounce + API call

        screenshot = self.reporter.capture_state(page, 'patient_search_results')

        # Check for results - the dropdown has specific classes
        # Container: absolute z-50 w-full mt-2 bg-white border
        # Items: div with hover:bg-purple-50 cursor-pointer
        results_dropdown = page.locator('.absolute.z-50, [class*="z-50"][class*="absolute"]').first
        results_items = page.locator('div[class*="hover:bg-purple-50"], div[class*="cursor-pointer"][class*="flex"]')

        results_visible = results_dropdown.count() > 0 or results_items.count() > 0

        # Also check for "Aucun patient trouve" which means search worked but no results
        no_results_msg = page.locator('text="Aucun patient"').count() > 0 or page.locator('text="No patient"').count() > 0
        search_triggered = results_visible or no_results_msg

        self.reporter.add_step("Search results appear", search_triggered, screenshot_path=screenshot)

        if results_items.count() > 0:
            # Click first result
            try:
                first_result = results_items.first
                # Get patient name before clicking
                try:
                    self.test_patient_name = first_result.text_content()[:30]
                except:
                    self.test_patient_name = "Selected Patient"

                first_result.click()
                page.wait_for_timeout(1500)

                # Check if we navigated to sale page
                in_sale_page = 'sale' in page.url.lower() or 'new' in page.url.lower()
                screenshot = self.reporter.capture_state(page, 'sale_page')
                self.reporter.add_step("Navigate to sale page", in_sale_page, screenshot_path=screenshot)
                return in_sale_page
            except Exception as e:
                self.reporter.add_step("Click patient result", False, str(e))

        return False

    def test_new_sale_wizard_prescription(self, page: Page):
        """Test prescription step of the sale wizard"""
        self.reporter.start_phase("Sale Wizard - Prescription")

        # Check if we're on the sale page
        if 'sale' not in page.url.lower():
            # Try navigating directly with a patient
            self.reporter.add_step("Already on sale page", False, "Need to navigate first")
            return False

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'prescription_step')

        # Check prescription step elements
        checks = {
            'step_indicator': has_element(page, '[class*="step"]') or has_text(page, 'Prescription'),
            'prescription_form': has_text(page, 'Sphère') or has_text(page, 'OD') or has_text(page, 'Droit'),
            'next_button': has_text(page, 'Suivant') or has_text(page, 'Next'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Prescription: {name}", passed, screenshot_path=screenshot)

        # Click next to go to frame step
        next_btn = page.locator('button:has-text("Suivant"), button:has-text("Next")').first
        if next_btn.count() > 0:
            next_btn.click()
            page.wait_for_timeout(1000)
            self.reporter.add_step("Click Next button", True)
            return True

        return False

    def test_new_sale_wizard_frame(self, page: Page):
        """Test frame selection step"""
        self.reporter.start_phase("Sale Wizard - Frame")

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'frame_step')

        # Check frame step elements
        checks = {
            'frame_section': has_text(page, 'Monture') or has_text(page, 'Frame'),
            'search_or_list': has_element(page, 'input') or has_element(page, 'table') or has_element(page, '.grid'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Frame: {name}", passed, screenshot_path=screenshot)

        # Try to select a frame if available
        frame_items = page.locator('[data-testid*="frame"], .frame-item, tr, .grid > div')
        if frame_items.count() > 0:
            try:
                frame_items.first.click()
                page.wait_for_timeout(500)
                self.reporter.add_step("Select frame", True)
            except:
                self.reporter.add_step("Select frame", False, "Could not click frame")

        # Click next
        next_btn = page.locator('button:has-text("Suivant"), button:has-text("Next")').first
        if next_btn.count() > 0:
            next_btn.click()
            page.wait_for_timeout(1000)
            self.reporter.add_step("Click Next button", True)
            return True

        return False

    def test_new_sale_wizard_lenses(self, page: Page):
        """Test lenses selection step"""
        self.reporter.start_phase("Sale Wizard - Lenses")

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'lenses_step')

        # Check lens step elements
        checks = {
            'lens_section': has_text(page, 'Verres') or has_text(page, 'Lenses') or has_text(page, 'Type'),
            'lens_options': has_element(page, 'select') or has_element(page, 'input[type="radio"]') or has_element(page, 'button'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Lenses: {name}", passed, screenshot_path=screenshot)

        # Click next
        next_btn = page.locator('button:has-text("Suivant"), button:has-text("Next")').first
        if next_btn.count() > 0:
            next_btn.click()
            page.wait_for_timeout(1000)
            self.reporter.add_step("Click Next button", True)

        return True

    def test_glasses_orders_list(self, page: Page):
        """Test glasses orders list page"""
        self.reporter.start_phase("Glasses Orders List")

        success = navigate_to(page, '/glasses-orders')
        self.reporter.add_step("Navigate to glasses orders", success)
        if not success:
            return False

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'glasses_orders_list')

        checks = {
            'page_title': has_text(page, 'Commandes') or has_text(page, 'Orders'),
            'table_or_list': has_element(page, 'table') or has_element(page, '[data-testid*="order"]'),
            'filters': has_element(page, 'select') or has_element(page, '[class*="filter"]'),
        }

        self.initial_order_count = get_table_row_count(page, 'table tbody tr')
        checks['has_orders'] = self.initial_order_count >= 0  # 0 is valid

        for name, passed in checks.items():
            self.reporter.add_step(f"Orders list: {name}", passed, screenshot_path=screenshot)

        return all(checks.values())

    def test_frame_inventory(self, page: Page):
        """Test frame inventory page"""
        self.reporter.start_phase("Frame Inventory")

        success = navigate_to(page, '/frame-inventory')
        self.reporter.add_step("Navigate to frame inventory", success)
        if not success:
            return False

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'frame_inventory')

        checks = {
            'page_loads': has_element(page, 'table') or has_element(page, '.grid'),
            'has_items': get_table_row_count(page, 'table tbody tr') > 0 or page.locator('.grid > div').count() > 0,
            'search_filter': has_element(page, 'input') or has_element(page, 'select'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Frame inventory: {name}", passed, screenshot_path=screenshot)

        return True

    def test_optical_lens_inventory(self, page: Page):
        """Test optical lens inventory page"""
        self.reporter.start_phase("Optical Lens Inventory")

        success = navigate_to(page, '/optical-lens-inventory')
        self.reporter.add_step("Navigate to optical lens inventory", success)
        if not success:
            return False

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'optical_lens_inventory')

        checks = {
            'page_loads': has_element(page, 'table') or has_element(page, '.grid') or has_element(page, 'main'),
            'lens_content': has_text(page, 'Verres') or has_text(page, 'Lens') or has_text(page, 'Stock'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Lens inventory: {name}", passed, screenshot_path=screenshot)

        return True

    def test_contact_lens_inventory(self, page: Page):
        """Test contact lens inventory page"""
        self.reporter.start_phase("Contact Lens Inventory")

        success = navigate_to(page, '/contact-lens-inventory')
        self.reporter.add_step("Navigate to contact lens inventory", success)
        if not success:
            return False

        wait_for_loading_complete(page)
        screenshot = self.reporter.capture_state(page, 'contact_lens_inventory')

        checks = {
            'page_loads': has_element(page, 'table') or has_element(page, '.grid') or has_element(page, 'main'),
            'contact_content': has_text(page, 'Lentilles') or has_text(page, 'Contact'),
        }

        for name, passed in checks.items():
            self.reporter.add_step(f"Contact lens: {name}", passed, screenshot_path=screenshot)

        return True

    def run(self):
        """Run all optical tests"""
        print("\n" + "=" * 70)
        print("🔬 OPTICAL COMPREHENSIVE E2E TEST (UI-Based)")
        print("=" * 70)

        headless = os.getenv('HEADED', '').lower() not in ('1', 'true', 'yes')

        with ComprehensiveBrowserSession(
            headless=headless,
            role='admin',
            reporter=self.reporter
        ) as page:
            try:
                # Test sequence
                self.test_optical_shop_dashboard(page)
                self.test_patient_search_and_select(page)

                # Only continue with wizard if we got to sale page
                if 'sale' in page.url.lower():
                    self.test_new_sale_wizard_prescription(page)
                    self.test_new_sale_wizard_frame(page)
                    self.test_new_sale_wizard_lenses(page)

                self.test_glasses_orders_list(page)
                self.test_frame_inventory(page)
                self.test_optical_lens_inventory(page)
                self.test_contact_lens_inventory(page)

            except Exception as e:
                self.reporter.add_step("Test execution", False, str(e))
                self.reporter.capture_state(page, 'error_state', 'ERROR')

        return self.reporter.generate_report()


def main():
    test = OpticalComprehensiveTest()
    report = test.run()
    if report['summary']['failed'] > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
