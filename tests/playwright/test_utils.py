"""
Shared test utilities for MedFlow E2E tests
Provides login, API helpers, and common configuration
"""
from playwright.sync_api import sync_playwright, Page, BrowserContext
import json
import os
import requests
from datetime import datetime
from typing import Optional, Dict, Any, List

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_URL = os.getenv('BASE_URL', 'http://localhost:5173')
API_URL = os.getenv('API_URL', 'http://localhost:5001')
SCREENSHOT_DIR = os.getenv('SCREENSHOT_DIR', 'screenshots')
DEFAULT_PASSWORD = "MedFlow$ecure1"

# Test user credentials by role (emails match actual database users)
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
}

# =============================================================================
# BROWSER LOGIN
# =============================================================================

def login(page: Page, role: str = 'admin', base_url: str = None) -> bool:
    """
    Login to MedFlow with specified role

    Args:
        page: Playwright page object
        role: User role (admin, doctor, nurse, etc.)
        base_url: Override base URL

    Returns:
        True if login successful, False otherwise
    """
    url = base_url or BASE_URL
    user = TEST_USERS.get(role, TEST_USERS['admin'])

    page.goto(f"{url}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    # Fill login form
    page.locator('#email').fill(user['email'])
    page.locator('#password').fill(user['password'])
    page.locator('button[type="submit"]').click()

    try:
        page.wait_for_url("**/home", timeout=15000)
        return True
    except:
        # Check if redirected elsewhere (not login)
        if '/login' not in page.url:
            return True
        return False


def login_as(page: Page, email: str, password: str, base_url: str = None) -> bool:
    """
    Login with specific credentials
    """
    url = base_url or BASE_URL

    page.goto(f"{url}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.locator('#email').fill(email)
    page.locator('#password').fill(password)
    page.locator('button[type="submit"]').click()

    try:
        page.wait_for_url("**/home", timeout=15000)
        return True
    except:
        if '/login' not in page.url:
            return True
        return False


def logout(page: Page) -> None:
    """Logout current user"""
    # Click user menu and logout
    try:
        page.click('[data-testid="user-menu"]')
        page.click('text=Déconnexion')
        page.wait_for_url("**/login", timeout=5000)
    except:
        # Fallback: navigate to login
        page.goto(f"{BASE_URL}/login")


# =============================================================================
# API HELPERS
# =============================================================================

class APIClient:
    """Helper for making authenticated API requests with CSRF support"""

    def __init__(self, role: str = 'admin'):
        self.role = role
        self.session = requests.Session()
        self.token = None
        self.csrf_token = None
        self._login()

    def _login(self) -> bool:
        """Login and get auth cookies"""
        user = TEST_USERS.get(self.role, TEST_USERS['admin'])
        response = self.session.post(
            f"{API_URL}/api/auth/login",
            json={'email': user['email'], 'password': user['password']},
            timeout=10
        )
        if response.ok:
            self.token = response.cookies.get('accessToken')
            # Make a GET request to obtain CSRF token (server sets XSRF-TOKEN cookie on GET)
            self._get_csrf_token()
            return True
        return False

    def _get_csrf_token(self):
        """Get CSRF token by making a GET request"""
        try:
            # Any authenticated GET request will set the XSRF-TOKEN cookie
            self.session.get(f"{API_URL}/api/auth/me", timeout=10)
            self.csrf_token = self.session.cookies.get('XSRF-TOKEN')
        except Exception:
            pass

    def _get_headers(self) -> Dict:
        """Get headers including CSRF token for state-changing requests"""
        headers = {}
        if self.csrf_token:
            headers['X-XSRF-TOKEN'] = self.csrf_token
        return headers

    def get(self, endpoint: str, **kwargs) -> requests.Response:
        """GET request to API endpoint"""
        kwargs.setdefault('timeout', 10)  # Add default timeout to prevent hanging
        return self.session.get(f"{API_URL}{endpoint}", **kwargs)

    def post(self, endpoint: str, data: Dict = None, **kwargs) -> requests.Response:
        """POST request to API endpoint with CSRF token"""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_headers())
        kwargs.setdefault('timeout', 15)
        return self.session.post(f"{API_URL}{endpoint}", json=data, headers=headers, **kwargs)

    def put(self, endpoint: str, data: Dict = None, **kwargs) -> requests.Response:
        """PUT request to API endpoint with CSRF token"""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_headers())
        kwargs.setdefault('timeout', 15)
        return self.session.put(f"{API_URL}{endpoint}", json=data, headers=headers, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> requests.Response:
        """DELETE request to API endpoint with CSRF token"""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_headers())
        kwargs.setdefault('timeout', 10)
        return self.session.delete(f"{API_URL}{endpoint}", headers=headers, **kwargs)


def api_login(role: str = 'admin') -> Optional[Dict]:
    """
    Login via API and return auth data

    Returns:
        Dict with user info and success status, or None on failure
    """
    user = TEST_USERS.get(role, TEST_USERS['admin'])
    try:
        response = requests.post(
            f"{API_URL}/api/auth/login",
            json={'email': user['email'], 'password': user['password']},
            timeout=10
        )
        if response.ok:
            return response.json()
    except Exception as e:
        print(f"API login error: {e}")
    return None


# =============================================================================
# SCREENSHOT & REPORTING
# =============================================================================

def take_screenshot(page: Page, name: str, subdir: str = None) -> str:
    """
    Take a screenshot with optimized settings

    Args:
        page: Playwright page
        name: Screenshot name (without extension)
        subdir: Optional subdirectory within SCREENSHOT_DIR

    Returns:
        Path to saved screenshot
    """
    dir_path = SCREENSHOT_DIR
    if subdir:
        dir_path = os.path.join(SCREENSHOT_DIR, subdir)
    os.makedirs(dir_path, exist_ok=True)

    # Sanitize name
    safe_name = "".join(c for c in name if c.isalnum() or c in '._- ').replace(' ', '_')
    path = os.path.join(dir_path, f"{safe_name}.jpg")

    page.screenshot(path=path, quality=60, type='jpeg')
    return path


class TestReporter:
    """Collects and saves test results"""

    def __init__(self, report_name: str):
        self.report_name = report_name
        self.results: List[Dict] = []
        self.start_time = datetime.now()

    def add_result(self, test_name: str, passed: bool, details: str = "",
                   category: str = "", screenshot: str = None):
        """Add a test result"""
        self.results.append({
            'test': test_name,
            'passed': passed,
            'details': details,
            'category': category,
            'screenshot': screenshot,
            'timestamp': datetime.now().isoformat()
        })
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {test_name}")
        if not passed and details:
            print(f"         {details[:100]}")

    def save(self, path: str = None):
        """Save report to JSON file"""
        if path is None:
            path = f"{self.report_name}_report.json"

        passed = sum(1 for r in self.results if r['passed'])
        failed = len(self.results) - passed

        report = {
            'name': self.report_name,
            'timestamp': self.start_time.isoformat(),
            'duration_seconds': (datetime.now() - self.start_time).total_seconds(),
            'summary': {
                'total': len(self.results),
                'passed': passed,
                'failed': failed,
                'pass_rate': f"{(passed/len(self.results)*100):.1f}%" if self.results else "N/A"
            },
            'results': self.results
        }

        with open(path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n=== {self.report_name} Summary ===")
        print(f"Total: {len(self.results)}, Passed: {passed}, Failed: {failed}")
        print(f"Report saved to: {path}")

        return report


# =============================================================================
# PAGE HELPERS
# =============================================================================

def wait_for_page_load(page: Page, timeout: int = 10000):
    """Wait for page to fully load"""
    page.wait_for_load_state("networkidle", timeout=timeout)
    page.wait_for_timeout(500)  # Extra time for React hydration


def navigate_to(page: Page, path: str, wait: bool = True) -> bool:
    """
    Navigate to a page path

    Args:
        page: Playwright page
        path: Path like '/patients' or '/invoicing'
        wait: Whether to wait for network idle

    Returns:
        True if navigation successful
    """
    try:
        page.goto(f"{BASE_URL}{path}")
        if wait:
            wait_for_page_load(page)
        return True
    except Exception as e:
        print(f"Navigation error to {path}: {e}")
        return False


def has_element(page: Page, selector: str) -> bool:
    """Check if element exists on page"""
    return page.locator(selector).count() > 0


def has_text(page: Page, text: str) -> bool:
    """Check if text exists on page"""
    return page.get_by_text(text, exact=False).count() > 0


def get_element_count(page: Page, selector: str) -> int:
    """Get count of elements matching selector"""
    return page.locator(selector).count()


def click_button(page: Page, text: str) -> bool:
    """Click button by text"""
    try:
        page.get_by_role("button", name=text).click()
        return True
    except:
        return False


def fill_form_field(page: Page, label: str, value: str) -> bool:
    """Fill form field by label"""
    try:
        page.get_by_label(label).fill(value)
        return True
    except:
        return False


def select_option(page: Page, selector: str, value: str) -> bool:
    """Select option from dropdown"""
    try:
        page.locator(selector).select_option(value)
        return True
    except:
        return False


# =============================================================================
# DATA HELPERS
# =============================================================================

def get_test_patient_id() -> Optional[str]:
    """Get a test patient ID from the database"""
    api = APIClient('admin')
    response = api.get('/api/patients?limit=1')
    if response.ok:
        data = response.json()
        patients = data.get('data', data.get('patients', []))
        if patients:
            return patients[0].get('_id')
    return None


def get_test_invoice_id() -> Optional[str]:
    """Get a test invoice ID from the database"""
    api = APIClient('admin')
    response = api.get('/api/invoices?limit=1')
    if response.ok:
        data = response.json()
        invoices = data.get('data', data.get('invoices', []))
        if invoices:
            return invoices[0].get('_id')
    return None


def get_clinic_ids() -> List[str]:
    """Get list of clinic IDs"""
    api = APIClient('admin')
    response = api.get('/api/clinics')
    if response.ok:
        data = response.json()
        clinics = data.get('data', data.get('clinics', []))
        return [c.get('_id') for c in clinics if c.get('_id')]
    return []


# =============================================================================
# CONTEXT MANAGERS
# =============================================================================

class BrowserSession:
    """Context manager for browser session with automatic cleanup"""

    def __init__(self, headless: bool = False, role: str = 'admin'):
        self.headless = headless
        self.role = role
        self.playwright = None
        self.browser = None
        self.page = None

    def __enter__(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        self.page = self.browser.new_page()
        if self.role:
            login(self.page, self.role)
        return self.page

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()


# =============================================================================
# ROLE PERMISSION HELPERS
# =============================================================================

# Expected permissions per role (for testing access control)
ROLE_PERMISSIONS = {
    'admin': {
        'can_access': ['/dashboard', '/patients', '/queue', '/appointments', '/settings',
                      '/users', '/audit', '/financial', '/pharmacy', '/laboratory'],
        'cannot_access': []
    },
    'doctor': {
        'can_access': ['/dashboard', '/patients', '/queue', '/appointments', '/prescriptions'],
        'cannot_access': ['/settings', '/users', '/audit', '/financial']
    },
    'nurse': {
        'can_access': ['/dashboard', '/patients', '/queue'],
        'cannot_access': ['/settings', '/users', '/financial']
    },
    'receptionist': {
        'can_access': ['/dashboard', '/patients', '/queue', '/appointments'],
        'cannot_access': ['/settings', '/users', '/prescriptions']
    },
    'pharmacist': {
        'can_access': ['/dashboard', '/pharmacy', '/prescriptions'],
        'cannot_access': ['/settings', '/users', '/laboratory']
    },
    'lab_technician': {
        'can_access': ['/dashboard', '/laboratory'],
        'cannot_access': ['/settings', '/users', '/pharmacy', '/financial']
    },
    'accountant': {
        'can_access': ['/dashboard', '/financial', '/invoicing'],
        'cannot_access': ['/settings', '/users', '/prescriptions', '/laboratory']
    },
}


def get_expected_permissions(role: str) -> Dict:
    """Get expected permission config for a role"""
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS['admin'])


# =============================================================================
# MAIN (for testing utilities)
# =============================================================================

if __name__ == '__main__':
    print("Testing utilities...")

    # Test API login
    print("\n1. Testing API login...")
    auth = api_login('admin')
    if auth:
        print(f"   OK - Logged in as: {auth.get('user', {}).get('email')}")
    else:
        print("   FAIL - API login failed")

    # Test APIClient
    print("\n2. Testing APIClient...")
    api = APIClient('admin')
    response = api.get('/api/health')
    print(f"   Health check: {response.status_code}")

    # Test browser login
    print("\n3. Testing browser login...")
    with BrowserSession(headless=True, role='admin') as page:
        print(f"   Logged in - URL: {page.url}")
        take_screenshot(page, 'utils_test', 'test')

    print("\nAll utilities working!")
