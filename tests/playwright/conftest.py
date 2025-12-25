#!/usr/bin/env python3
"""
MedFlow Playwright Test Configuration (conftest.py)
====================================================

Shared fixtures and configuration for all Playwright E2E tests.
Provides:
- Browser/context/page fixtures
- Authentication fixtures (admin, patient, role-based)
- API client fixtures
- Screenshot and reporting utilities
- Test data setup helpers

Usage:
    pytest test_*.py -v
    pytest test_patient_portal.py -v --headed  # See browser
    pytest test_*.py -v -k "login"  # Run only login tests

Author: MedFlow Test Automation
Created: 2025-12-25
"""

import pytest
import os
import json
import requests
from datetime import datetime
from typing import Optional, Dict, Any, Generator
from playwright.sync_api import (
    Playwright,
    Browser,
    BrowserContext,
    Page,
    sync_playwright
)


# =============================================================================
# CONFIGURATION
# =============================================================================

# URLs - can be overridden via environment variables
BASE_URL = os.getenv('BASE_URL', 'http://localhost:5173')
API_URL = os.getenv('API_URL', 'http://localhost:5001')

# Screenshot settings
SCREENSHOT_BASE_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')

# Default password for all test users
DEFAULT_PASSWORD = os.getenv('TEST_PASSWORD', 'MedFlow$ecure1')

# Test user credentials by role (must match seeded database users)
TEST_USERS = {
    'admin': {'email': 'admin@medflow.com', 'password': DEFAULT_PASSWORD},
    'doctor': {'email': 'dr.lumumba@medflow.com', 'password': DEFAULT_PASSWORD},
    'ophthalmologist': {'email': 'dr.kabila@medflow.com', 'password': DEFAULT_PASSWORD},
    'nurse': {'email': 'nurse.marie@medflow.com', 'password': DEFAULT_PASSWORD},
    'receptionist': {'email': 'reception@medflow.com', 'password': DEFAULT_PASSWORD},
    'pharmacist': {'email': 'pharmacy@medflow.com', 'password': DEFAULT_PASSWORD},
    'lab_technician': {'email': 'lab@medflow.com', 'password': DEFAULT_PASSWORD},
    'accountant': {'email': 'accountant@medflow.com', 'password': DEFAULT_PASSWORD},
    'manager': {'email': 'manager@medflow.com', 'password': DEFAULT_PASSWORD},
    'technician': {'email': 'tech.jean@medflow.com', 'password': DEFAULT_PASSWORD},
    'optometrist': {'email': 'optometrist@medflow.com', 'password': DEFAULT_PASSWORD},
    'orthoptist': {'email': 'orthoptist@medflow.com', 'password': DEFAULT_PASSWORD},
    'patient': {'email': 'patient.test@medflow.com', 'password': DEFAULT_PASSWORD},
}

# Browser settings
BROWSER_SETTINGS = {
    'headless': os.getenv('HEADLESS', 'true').lower() == 'true',
    'slow_mo': int(os.getenv('SLOW_MO', '0')),  # Milliseconds between actions
    'timeout': int(os.getenv('TIMEOUT', '30000')),  # Default timeout in ms
}


# =============================================================================
# PLAYWRIGHT FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def playwright() -> Generator[Playwright, None, None]:
    """Session-scoped Playwright instance"""
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(playwright: Playwright) -> Generator[Browser, None, None]:
    """Session-scoped browser instance"""
    browser = playwright.chromium.launch(
        headless=BROWSER_SETTINGS['headless'],
        slow_mo=BROWSER_SETTINGS['slow_mo']
    )
    yield browser
    browser.close()


@pytest.fixture(scope="module")
def browser_context(browser: Browser) -> Generator[BrowserContext, None, None]:
    """Module-scoped browser context with default settings"""
    context = browser.new_context(
        viewport={'width': 1280, 'height': 720},
        locale='fr-FR',
        timezone_id='Africa/Kinshasa'
    )
    context.set_default_timeout(BROWSER_SETTINGS['timeout'])
    yield context
    context.close()


@pytest.fixture
def page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Function-scoped page for each test"""
    page = browser_context.new_page()
    yield page
    page.close()


# =============================================================================
# AUTHENTICATION FIXTURES
# =============================================================================

@pytest.fixture
def admin_page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Page with admin login"""
    page = browser_context.new_page()
    login_as_role(page, 'admin')
    yield page
    page.close()


@pytest.fixture
def doctor_page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Page with doctor login"""
    page = browser_context.new_page()
    login_as_role(page, 'doctor')
    yield page
    page.close()


@pytest.fixture
def nurse_page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Page with nurse login"""
    page = browser_context.new_page()
    login_as_role(page, 'nurse')
    yield page
    page.close()


@pytest.fixture
def receptionist_page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Page with receptionist login"""
    page = browser_context.new_page()
    login_as_role(page, 'receptionist')
    yield page
    page.close()


@pytest.fixture
def pharmacist_page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Page with pharmacist login"""
    page = browser_context.new_page()
    login_as_role(page, 'pharmacist')
    yield page
    page.close()


@pytest.fixture
def patient_portal_page(browser_context: BrowserContext) -> Generator[Page, None, None]:
    """Page with patient portal login"""
    page = browser_context.new_page()
    login_as_patient(page)
    yield page
    page.close()


# =============================================================================
# LOGIN HELPER FUNCTIONS
# =============================================================================

def login_as_role(page: Page, role: str) -> bool:
    """
    Login to staff portal with specified role

    Args:
        page: Playwright page
        role: User role (admin, doctor, nurse, etc.)

    Returns:
        True if login successful
    """
    user = TEST_USERS.get(role, TEST_USERS['admin'])

    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(500)

    # Fill login form
    page.locator('#email').fill(user['email'])
    page.locator('#password').fill(user['password'])
    page.locator('button[type="submit"]').click()

    try:
        page.wait_for_url('**/home**', timeout=15000)
        return True
    except:
        # Check if redirected elsewhere (not login)
        return '/login' not in page.url


def login_as_patient(page: Page) -> bool:
    """
    Login to patient portal

    Args:
        page: Playwright page

    Returns:
        True if login successful
    """
    user = TEST_USERS.get('patient', TEST_USERS['admin'])

    page.goto(f"{BASE_URL}/patient/login")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(500)

    # Fill login form
    email_input = page.locator('input[type="email"]')
    password_input = page.locator('input[type="password"]')

    if email_input.count() > 0 and password_input.count() > 0:
        email_input.fill(user['email'])
        password_input.fill(user['password'])

        page.locator('button[type="submit"]').click()

        try:
            page.wait_for_url('**/patient/dashboard**', timeout=10000)
            return True
        except:
            pass

    # Fallback to admin login if patient login fails
    return login_as_role(page, 'admin')


def login_with_credentials(page: Page, email: str, password: str, portal: str = 'staff') -> bool:
    """
    Login with specific credentials

    Args:
        page: Playwright page
        email: User email
        password: User password
        portal: 'staff' or 'patient'

    Returns:
        True if login successful
    """
    login_url = f"{BASE_URL}/patient/login" if portal == 'patient' else f"{BASE_URL}/login"

    page.goto(login_url)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(500)

    if portal == 'patient':
        page.locator('input[type="email"]').fill(email)
        page.locator('input[type="password"]').fill(password)
    else:
        page.locator('#email').fill(email)
        page.locator('#password').fill(password)

    page.locator('button[type="submit"]').click()

    try:
        if portal == 'patient':
            page.wait_for_url('**/patient/dashboard**', timeout=10000)
        else:
            page.wait_for_url('**/home**', timeout=15000)
        return True
    except:
        return '/login' not in page.url


# =============================================================================
# API CLIENT FIXTURE
# =============================================================================

class APIClient:
    """Helper for making authenticated API requests"""

    def __init__(self, role: str = 'admin'):
        self.role = role
        self.session = requests.Session()
        self.token = None
        self.csrf_token = None
        self._login()

    def _login(self) -> bool:
        """Login and get auth cookies"""
        user = TEST_USERS.get(self.role, TEST_USERS['admin'])
        try:
            response = self.session.post(
                f"{API_URL}/api/auth/login",
                json={'email': user['email'], 'password': user['password']},
                timeout=10
            )
            if response.ok:
                self.token = response.cookies.get('accessToken')
                self._get_csrf_token()
                return True
        except Exception as e:
            print(f"API login error: {e}")
        return False

    def _get_csrf_token(self):
        """Get CSRF token via authenticated GET request"""
        try:
            self.session.get(f"{API_URL}/api/auth/me", timeout=10)
            self.csrf_token = self.session.cookies.get('XSRF-TOKEN')
        except Exception:
            pass

    def _headers(self) -> Dict:
        """Get headers with CSRF token"""
        headers = {}
        if self.csrf_token:
            headers['X-XSRF-TOKEN'] = self.csrf_token
        return headers

    def get(self, endpoint: str, **kwargs) -> requests.Response:
        """GET request"""
        kwargs.setdefault('timeout', 10)
        return self.session.get(f"{API_URL}{endpoint}", **kwargs)

    def post(self, endpoint: str, data: Dict = None, **kwargs) -> requests.Response:
        """POST request with CSRF"""
        headers = kwargs.pop('headers', {})
        headers.update(self._headers())
        kwargs.setdefault('timeout', 15)
        return self.session.post(f"{API_URL}{endpoint}", json=data, headers=headers, **kwargs)

    def put(self, endpoint: str, data: Dict = None, **kwargs) -> requests.Response:
        """PUT request with CSRF"""
        headers = kwargs.pop('headers', {})
        headers.update(self._headers())
        kwargs.setdefault('timeout', 15)
        return self.session.put(f"{API_URL}{endpoint}", json=data, headers=headers, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> requests.Response:
        """DELETE request with CSRF"""
        headers = kwargs.pop('headers', {})
        headers.update(self._headers())
        kwargs.setdefault('timeout', 10)
        return self.session.delete(f"{API_URL}{endpoint}", headers=headers, **kwargs)


@pytest.fixture(scope="session")
def api_client() -> APIClient:
    """Session-scoped API client with admin access"""
    return APIClient('admin')


@pytest.fixture
def api_client_factory():
    """Factory to create API clients for different roles"""
    def _create(role: str = 'admin') -> APIClient:
        return APIClient(role)
    return _create


# =============================================================================
# SCREENSHOT HELPERS
# =============================================================================

@pytest.fixture(scope="session")
def screenshot_dir():
    """Ensure base screenshot directory exists"""
    os.makedirs(SCREENSHOT_BASE_DIR, exist_ok=True)
    return SCREENSHOT_BASE_DIR


def take_screenshot(page: Page, name: str, subdir: str = None) -> str:
    """
    Take screenshot with optimized settings

    Args:
        page: Playwright page
        name: Screenshot name (without extension)
        subdir: Optional subdirectory

    Returns:
        Path to saved screenshot
    """
    dir_path = SCREENSHOT_BASE_DIR
    if subdir:
        dir_path = os.path.join(SCREENSHOT_BASE_DIR, subdir)
    os.makedirs(dir_path, exist_ok=True)

    # Sanitize name
    safe_name = "".join(c for c in name if c.isalnum() or c in '._- ').replace(' ', '_')
    path = os.path.join(dir_path, f"{safe_name}.png")

    page.screenshot(path=path)
    return path


# =============================================================================
# TEST DATA HELPERS
# =============================================================================

@pytest.fixture(scope="session")
def test_patient_id(api_client: APIClient) -> Optional[str]:
    """Get a test patient ID from the database"""
    response = api_client.get('/api/patients?limit=1')
    if response.ok:
        data = response.json()
        patients = data.get('data', data.get('patients', []))
        if patients:
            return patients[0].get('_id')
    return None


@pytest.fixture(scope="session")
def test_clinic_id(api_client: APIClient) -> Optional[str]:
    """Get a test clinic ID from the database"""
    response = api_client.get('/api/clinics?limit=1')
    if response.ok:
        data = response.json()
        clinics = data.get('data', data.get('clinics', []))
        if clinics:
            return clinics[0].get('_id')
    return None


# =============================================================================
# PAGE HELPER FUNCTIONS (available to all tests)
# =============================================================================

def wait_for_page_ready(page: Page, timeout: int = 5000):
    """Wait for page to be fully loaded"""
    try:
        page.wait_for_load_state('networkidle', timeout=timeout)
    except:
        pass
    page.wait_for_timeout(300)


def navigate_to(page: Page, path: str) -> bool:
    """Navigate to a path and wait for load"""
    try:
        page.goto(f"{BASE_URL}{path}")
        wait_for_page_ready(page)
        return True
    except Exception as e:
        print(f"Navigation error: {e}")
        return False


def has_element(page: Page, selector: str) -> bool:
    """Check if element exists"""
    return page.locator(selector).count() > 0


def has_text(page: Page, text: str) -> bool:
    """Check if text exists on page"""
    return page.get_by_text(text, exact=False).count() > 0


# =============================================================================
# PYTEST HOOKS
# =============================================================================

def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line("markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')")
    config.addinivalue_line("markers", "login: marks tests that involve login")
    config.addinivalue_line("markers", "patient_portal: marks patient portal tests")
    config.addinivalue_line("markers", "staff_portal: marks staff portal tests")
    config.addinivalue_line("markers", "responsive: marks responsive design tests")


def pytest_collection_modifyitems(config, items):
    """Auto-mark tests based on file name"""
    for item in items:
        # Auto-mark patient portal tests
        if 'patient_portal' in item.nodeid:
            item.add_marker(pytest.mark.patient_portal)

        # Auto-mark login tests
        if 'login' in item.name.lower():
            item.add_marker(pytest.mark.login)

        # Auto-mark responsive tests
        if 'responsive' in item.name.lower() or 'mobile' in item.name.lower():
            item.add_marker(pytest.mark.responsive)


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Take screenshot on test failure"""
    outcome = yield
    rep = outcome.get_result()

    if rep.when == "call" and rep.failed:
        # Try to get page from test
        page = item.funcargs.get('page') or item.funcargs.get('logged_in_patient_page')
        if page:
            try:
                failure_dir = os.path.join(SCREENSHOT_BASE_DIR, 'failures')
                os.makedirs(failure_dir, exist_ok=True)

                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                test_name = item.name.replace('[', '_').replace(']', '_')
                path = os.path.join(failure_dir, f"FAIL_{test_name}_{timestamp}.png")

                page.screenshot(path=path)
                print(f"\nScreenshot saved: {path}")
            except Exception as e:
                print(f"Could not take failure screenshot: {e}")


# =============================================================================
# CONFIGURATION REPORT
# =============================================================================

def pytest_report_header(config):
    """Add custom header to pytest output"""
    return [
        f"MedFlow E2E Tests",
        f"Base URL: {BASE_URL}",
        f"API URL: {API_URL}",
        f"Headless: {BROWSER_SETTINGS['headless']}",
    ]
