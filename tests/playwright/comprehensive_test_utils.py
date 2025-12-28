"""
Comprehensive Test Utilities for MedFlow E2E Tests
===================================================

Enhanced utilities for comprehensive module testing that verifies
UI updates correctly after data changes across all major flows:
- Optical (glasses orders, frames, lenses)
- Surgery (cases, scheduling, reports)
- Laboratory (orders, specimens, results)
- Queue/Appointments

Author: MedFlow Test Automation
Created: 2025-12-28
"""
import json
import os
import time
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from playwright.sync_api import Page, sync_playwright, expect

# Import from existing utilities
from test_utils import (
    BASE_URL, API_URL, SCREENSHOT_DIR, DEFAULT_PASSWORD, TEST_USERS,
    APIClient, login, navigate_to, has_element, has_text, take_screenshot,
    wait_for_page_load
)

# =============================================================================
# ENHANCED CONFIGURATION
# =============================================================================

COMPREHENSIVE_SCREENSHOT_DIR = os.path.join(SCREENSHOT_DIR, 'comprehensive')

# Test data for each module
TEST_DATA = {
    'optical': {
        'frame': {
            'brand': 'Ray-Ban',
            'model': 'RB5154',
            'color': 'Noir',
            'size': '52-20-145',
            'price': 150000  # CDF
        },
        'prescription': {
            'od': {'sphere': -2.00, 'cylinder': -0.50, 'axis': 90},
            'os': {'sphere': -1.75, 'cylinder': -0.75, 'axis': 85},
            'addition': 2.00
        }
    },
    'surgery': {
        'procedure': 'Phacoémulsification',
        'eye': 'OD',
        'anesthesia': 'Locale',
        'iol_power': 21.5
    },
    'laboratory': {
        'test_codes': ['GLY', 'HBA1C', 'CREAT'],
        'priority': 'normal'
    },
    'appointment': {
        'type': 'consultation',
        'duration': 30,
        'reason': 'Contrôle ophtalmologique'
    }
}


# =============================================================================
# COMPREHENSIVE TEST REPORTER
# =============================================================================

class ComprehensiveTestReporter:
    """
    Enhanced test reporter for comprehensive module testing.
    Tracks test phases, captures before/after states, and generates detailed reports.
    """

    def __init__(self, module_name: str, output_dir: str = None):
        self.module_name = module_name
        self.output_dir = output_dir or COMPREHENSIVE_SCREENSHOT_DIR
        self.start_time = datetime.now()
        self.results: List[Dict] = []
        self.phase_results: Dict[str, List[Dict]] = {}
        self.current_phase = None

        # Ensure output directory exists
        self.module_dir = os.path.join(self.output_dir, module_name.lower())
        os.makedirs(self.module_dir, exist_ok=True)

    def start_phase(self, phase_name: str):
        """Start a new test phase"""
        self.current_phase = phase_name
        self.phase_results[phase_name] = []
        print(f"\n{'='*60}")
        print(f"📋 Phase: {phase_name}")
        print(f"{'='*60}")

    def add_step(self, step_name: str, passed: bool, details: str = "",
                 screenshot_path: str = None, data: Dict = None):
        """Add a test step result"""
        result = {
            'step': step_name,
            'phase': self.current_phase,
            'passed': passed,
            'details': details,
            'screenshot': screenshot_path,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }

        self.results.append(result)
        if self.current_phase:
            self.phase_results[self.current_phase].append(result)

        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} {step_name}")
        if details and not passed:
            print(f"         ⚠️  {details[:100]}")

    def capture_state(self, page: Page, state_name: str, prefix: str = "") -> str:
        """Capture a screenshot for state comparison"""
        safe_name = f"{prefix}_{state_name}" if prefix else state_name
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in '._- ').replace(' ', '_')
        path = os.path.join(self.module_dir, f"{safe_name}.png")
        page.screenshot(path=path)
        return path

    def verify_ui_change(self, page: Page, expected_changes: Dict[str, Any],
                         step_name: str) -> bool:
        """
        Verify UI reflects expected changes after an action.

        Args:
            page: Playwright page
            expected_changes: Dict of expected UI changes to verify
            step_name: Name of the verification step

        Returns:
            True if all expected changes are verified
        """
        all_passed = True
        details = []

        for change_type, expected in expected_changes.items():
            if change_type == 'text_present':
                for text in expected if isinstance(expected, list) else [expected]:
                    if not has_text(page, text):
                        all_passed = False
                        details.append(f"Text not found: '{text}'")

            elif change_type == 'text_absent':
                for text in expected if isinstance(expected, list) else [expected]:
                    if has_text(page, text):
                        all_passed = False
                        details.append(f"Text should not be present: '{text}'")

            elif change_type == 'element_present':
                for selector in expected if isinstance(expected, list) else [expected]:
                    if not has_element(page, selector):
                        all_passed = False
                        details.append(f"Element not found: '{selector}'")

            elif change_type == 'element_count':
                for selector, count in expected.items():
                    actual = page.locator(selector).count()
                    if actual != count:
                        all_passed = False
                        details.append(f"Element count mismatch: '{selector}' expected {count}, got {actual}")

            elif change_type == 'element_value':
                for selector, value in expected.items():
                    try:
                        actual = page.locator(selector).input_value()
                        if actual != value:
                            all_passed = False
                            details.append(f"Value mismatch: '{selector}' expected '{value}', got '{actual}'")
                    except:
                        all_passed = False
                        details.append(f"Could not get value of: '{selector}'")

        screenshot = self.capture_state(page, step_name)
        self.add_step(step_name, all_passed, "; ".join(details), screenshot)
        return all_passed

    def generate_report(self) -> Dict:
        """Generate comprehensive test report"""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()

        passed = sum(1 for r in self.results if r['passed'])
        failed = len(self.results) - passed

        # Phase summaries
        phase_summaries = {}
        for phase, results in self.phase_results.items():
            phase_passed = sum(1 for r in results if r['passed'])
            phase_summaries[phase] = {
                'total': len(results),
                'passed': phase_passed,
                'failed': len(results) - phase_passed,
                'pass_rate': f"{(phase_passed/len(results)*100):.1f}%" if results else "N/A"
            }

        report = {
            'module': self.module_name,
            'start_time': self.start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': duration,
            'summary': {
                'total_steps': len(self.results),
                'passed': passed,
                'failed': failed,
                'pass_rate': f"{(passed/len(self.results)*100):.1f}%" if self.results else "N/A"
            },
            'phases': phase_summaries,
            'results': self.results
        }

        # Save report
        report_path = os.path.join(self.module_dir, 'test_report.json')
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        # Generate markdown summary
        md_path = os.path.join(self.module_dir, 'REPORT.md')
        self._generate_markdown_report(report, md_path)

        # Print summary
        print(f"\n{'='*60}")
        print(f"📊 {self.module_name} Test Summary")
        print(f"{'='*60}")
        print(f"Duration: {duration:.1f}s")
        print(f"Total Steps: {len(self.results)}")
        print(f"Passed: {passed} ({(passed/len(self.results)*100):.1f}%)" if self.results else "Passed: 0")
        print(f"Failed: {failed}")
        print(f"\nReports saved to: {self.module_dir}")

        return report

    def _generate_markdown_report(self, report: Dict, path: str):
        """Generate markdown version of the report"""
        with open(path, 'w') as f:
            f.write(f"# {self.module_name} Test Report\n\n")
            f.write(f"**Date:** {report['start_time'][:10]}\n")
            f.write(f"**Duration:** {report['duration_seconds']:.1f}s\n\n")

            f.write("## Summary\n\n")
            f.write(f"| Metric | Value |\n")
            f.write(f"|--------|-------|\n")
            f.write(f"| Total Steps | {report['summary']['total_steps']} |\n")
            f.write(f"| Passed | {report['summary']['passed']} |\n")
            f.write(f"| Failed | {report['summary']['failed']} |\n")
            f.write(f"| Pass Rate | {report['summary']['pass_rate']} |\n\n")

            f.write("## Phase Results\n\n")
            for phase, summary in report['phases'].items():
                status = "✅" if summary['failed'] == 0 else "❌"
                f.write(f"### {status} {phase}\n\n")
                f.write(f"- Total: {summary['total']}\n")
                f.write(f"- Passed: {summary['passed']}\n")
                f.write(f"- Failed: {summary['failed']}\n\n")

            f.write("## Detailed Results\n\n")
            current_phase = None
            for result in report['results']:
                if result['phase'] != current_phase:
                    current_phase = result['phase']
                    f.write(f"\n### {current_phase}\n\n")

                status = "✅" if result['passed'] else "❌"
                f.write(f"- {status} {result['step']}\n")
                if result['details'] and not result['passed']:
                    f.write(f"  - ⚠️ {result['details']}\n")


# =============================================================================
# UI INTERACTION HELPERS
# =============================================================================

def wait_for_loading_complete(page: Page, timeout: int = 10000):
    """Wait for all loading indicators to disappear"""
    loading_selectors = [
        '.loading', '.spinner', '[data-loading="true"]',
        '.animate-spin', '.skeleton', '[aria-busy="true"]'
    ]

    for selector in loading_selectors:
        try:
            page.wait_for_selector(selector, state='hidden', timeout=timeout)
        except:
            pass

    # Extra wait for React updates
    page.wait_for_timeout(300)


def wait_for_toast(page: Page, expected_text: str = None, timeout: int = 5000) -> bool:
    """Wait for a toast notification to appear"""
    try:
        toast = page.locator('.Toastify__toast, [role="alert"]')
        toast.wait_for(state='visible', timeout=timeout)

        if expected_text:
            return expected_text.lower() in toast.text_content().lower()
        return True
    except:
        return False


def click_and_wait(page: Page, selector: str, wait_for: str = None,
                   timeout: int = 5000) -> bool:
    """Click element and wait for response"""
    try:
        page.locator(selector).click()

        if wait_for:
            page.wait_for_selector(wait_for, timeout=timeout)
        else:
            wait_for_loading_complete(page, timeout)

        return True
    except Exception as e:
        print(f"Click failed for '{selector}': {e}")
        return False


def fill_and_submit_form(page: Page, fields: Dict[str, str],
                         submit_selector: str = 'button[type="submit"]') -> bool:
    """Fill form fields and submit"""
    try:
        for selector, value in fields.items():
            element = page.locator(selector)
            if element.count() > 0:
                element.fill(value)
                page.wait_for_timeout(100)

        page.locator(submit_selector).click()
        wait_for_loading_complete(page)
        return True
    except Exception as e:
        print(f"Form submission failed: {e}")
        return False


def get_table_row_count(page: Page, table_selector: str = 'table tbody tr') -> int:
    """Get number of rows in a table"""
    try:
        return page.locator(table_selector).count()
    except:
        return 0


def get_stat_value(page: Page, stat_selector: str) -> Optional[str]:
    """Get value from a stat card or display"""
    try:
        return page.locator(stat_selector).text_content().strip()
    except:
        return None


def select_dropdown_option(page: Page, trigger_selector: str, option_text: str) -> bool:
    """Select option from a dropdown/select component"""
    try:
        # Click to open dropdown
        page.locator(trigger_selector).click()
        page.wait_for_timeout(200)

        # Try different option patterns
        option_selectors = [
            f'[role="option"]:has-text("{option_text}")',
            f'.dropdown-item:has-text("{option_text}")',
            f'option:has-text("{option_text}")',
            f'li:has-text("{option_text}")'
        ]

        for selector in option_selectors:
            if page.locator(selector).count() > 0:
                page.locator(selector).first.click()
                page.wait_for_timeout(100)
                return True

        return False
    except:
        return False


# =============================================================================
# DATA VERIFICATION HELPERS
# =============================================================================

def verify_list_contains_item(page: Page, list_selector: str,
                              item_text: str) -> bool:
    """Verify a list contains an item with specific text"""
    try:
        items = page.locator(list_selector)
        for i in range(items.count()):
            if item_text.lower() in items.nth(i).text_content().lower():
                return True
        return False
    except:
        return False


def verify_stat_updated(page: Page, stat_selector: str,
                        expected_value: str = None,
                        compare_to: str = None,
                        comparison: str = 'different') -> bool:
    """
    Verify a stat value has been updated.

    Args:
        page: Playwright page
        stat_selector: Selector for the stat element
        expected_value: Optional specific value to check for
        compare_to: Previous value to compare against
        comparison: 'different', 'greater', 'less', 'equal'
    """
    try:
        current = get_stat_value(page, stat_selector)

        if expected_value:
            return current == expected_value

        if compare_to:
            if comparison == 'different':
                return current != compare_to
            elif comparison == 'greater':
                return int(current) > int(compare_to)
            elif comparison == 'less':
                return int(current) < int(compare_to)
            elif comparison == 'equal':
                return current == compare_to

        return current is not None
    except:
        return False


def capture_before_after(page: Page, action_fn, reporter: ComprehensiveTestReporter,
                         action_name: str, verify_changes: Dict = None) -> Tuple[bool, str, str]:
    """
    Capture before/after states around an action.

    Args:
        page: Playwright page
        action_fn: Function to execute (the action)
        reporter: Test reporter
        action_name: Name of the action
        verify_changes: Expected changes to verify after

    Returns:
        Tuple of (success, before_screenshot, after_screenshot)
    """
    # Capture before
    before_path = reporter.capture_state(page, f"{action_name}_before", "state")

    # Execute action
    try:
        action_result = action_fn()
        success = action_result if action_result is not None else True
    except Exception as e:
        success = False
        reporter.add_step(f"Action: {action_name}", False, str(e), before_path)
        return (False, before_path, None)

    # Wait for UI to update
    wait_for_loading_complete(page)
    page.wait_for_timeout(500)

    # Capture after
    after_path = reporter.capture_state(page, f"{action_name}_after", "state")

    # Verify changes if specified
    if verify_changes and success:
        success = reporter.verify_ui_change(page, verify_changes, f"Verify: {action_name}")
    else:
        reporter.add_step(f"Action: {action_name}", success, "", after_path)

    return (success, before_path, after_path)


# =============================================================================
# MODULE-SPECIFIC HELPERS
# =============================================================================

class OpticalTestHelper:
    """Helper methods for optical module testing"""

    @staticmethod
    def navigate_to_glasses_orders(page: Page) -> bool:
        return navigate_to(page, '/glasses-orders')

    @staticmethod
    def navigate_to_optical_shop(page: Page) -> bool:
        return navigate_to(page, '/optical-shop')

    @staticmethod
    def get_order_count(page: Page) -> int:
        return get_table_row_count(page, 'table tbody tr')

    @staticmethod
    def get_pending_count(page: Page) -> Optional[str]:
        return get_stat_value(page, '[data-stat="pending"] .stat-value, .stat-card:has-text("En attente") .value')


class SurgeryTestHelper:
    """Helper methods for surgery module testing"""

    @staticmethod
    def navigate_to_dashboard(page: Page) -> bool:
        return navigate_to(page, '/surgery')

    @staticmethod
    def navigate_to_new_case(page: Page) -> bool:
        return navigate_to(page, '/surgery/new')

    @staticmethod
    def get_scheduled_count(page: Page) -> Optional[str]:
        return get_stat_value(page, '[data-stat="scheduled"] .stat-value, .stat-card:has-text("Programmé") .value')

    @staticmethod
    def get_today_count(page: Page) -> Optional[str]:
        return get_stat_value(page, '[data-stat="today"] .stat-value, .stat-card:has-text("Aujourd") .value')


class LaboratoryTestHelper:
    """Helper methods for laboratory module testing"""

    @staticmethod
    def navigate_to_lab(page: Page) -> bool:
        return navigate_to(page, '/laboratory')

    @staticmethod
    def get_pending_orders(page: Page) -> int:
        return get_table_row_count(page, 'table tbody tr')

    @staticmethod
    def get_pending_stat(page: Page) -> Optional[str]:
        return get_stat_value(page, '[data-stat="pending"], .stat-card:has-text("En attente") .value')


class QueueTestHelper:
    """Helper methods for queue/appointments testing"""

    @staticmethod
    def navigate_to_queue(page: Page) -> bool:
        return navigate_to(page, '/queue')

    @staticmethod
    def navigate_to_appointments(page: Page) -> bool:
        return navigate_to(page, '/appointments')

    @staticmethod
    def get_waiting_count(page: Page) -> int:
        """Get number of patients waiting"""
        try:
            text = get_stat_value(page, '.stat-card:has-text("En attente") .value')
            return int(text) if text else 0
        except:
            return 0


# =============================================================================
# BROWSER SESSION CONTEXT
# =============================================================================

class ComprehensiveBrowserSession:
    """Enhanced browser session for comprehensive testing"""

    def __init__(self, headless: bool = True, role: str = 'admin',
                 reporter: ComprehensiveTestReporter = None):
        self.headless = headless
        self.role = role
        self.reporter = reporter
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    def __enter__(self) -> Page:
        # Check HEADED env var
        if os.getenv('HEADED', '').lower() in ('1', 'true', 'yes'):
            self.headless = False

        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            slow_mo=100 if not self.headless else 0
        )
        self.context = self.browser.new_context(
            viewport={'width': 1280, 'height': 720},
            locale='fr-FR',
            timezone_id='Africa/Kinshasa'
        )
        self.page = self.context.new_page()

        # Login
        if self.role:
            success = login(self.page, self.role)
            if self.reporter:
                self.reporter.add_step(f"Login as {self.role}", success)

        return self.page

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            # Capture failure screenshot if exception occurred
            if exc_type and self.reporter:
                self.reporter.capture_state(self.page, 'failure_final', 'ERROR')

        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()


# =============================================================================
# API VERIFICATION HELPERS
# =============================================================================

def verify_api_and_ui_match(page: Page, api_client: APIClient,
                            api_endpoint: str, ui_selectors: Dict[str, str],
                            reporter: ComprehensiveTestReporter) -> bool:
    """
    Verify that API data matches what's displayed in the UI.

    Args:
        page: Playwright page
        api_client: APIClient instance
        api_endpoint: API endpoint to query
        ui_selectors: Dict mapping API field names to UI selectors
        reporter: Test reporter
    """
    try:
        # Get API data
        response = api_client.get(api_endpoint)
        if not response.ok:
            reporter.add_step("API-UI Match: Fetch data", False, f"API returned {response.status_code}")
            return False

        api_data = response.json()
        data = api_data.get('data', api_data)

        # Verify each field
        all_match = True
        for field, selector in ui_selectors.items():
            api_value = str(data.get(field, ''))
            try:
                ui_value = page.locator(selector).text_content().strip()
                if api_value.lower() not in ui_value.lower():
                    all_match = False
                    reporter.add_step(
                        f"API-UI Match: {field}",
                        False,
                        f"API='{api_value}', UI='{ui_value}'"
                    )
            except:
                all_match = False
                reporter.add_step(f"API-UI Match: {field}", False, f"Could not find UI element: {selector}")

        if all_match:
            reporter.add_step("API-UI Match: All fields", True)

        return all_match
    except Exception as e:
        reporter.add_step("API-UI Match", False, str(e))
        return False


# =============================================================================
# MAIN (for testing utilities)
# =============================================================================

if __name__ == '__main__':
    print("Testing comprehensive utilities...")

    # Create test reporter
    reporter = ComprehensiveTestReporter('utilities_test')
    reporter.start_phase("Basic Tests")

    # Test browser session
    with ComprehensiveBrowserSession(headless=True, role='admin', reporter=reporter) as page:
        # Navigate and capture
        reporter.add_step("Navigate to home", navigate_to(page, '/home'))
        reporter.capture_state(page, 'home_page')

        # Test UI verification
        reporter.verify_ui_change(page, {
            'text_present': ['MedFlow', 'Patients'],
            'element_present': ['nav', 'main']
        }, "Home page elements")

    # Generate report
    report = reporter.generate_report()
    print(f"\nTest complete! Pass rate: {report['summary']['pass_rate']}")
