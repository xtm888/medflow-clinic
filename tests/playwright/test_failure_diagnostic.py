"""
MedFlow Failure Diagnostic Tests
================================
Investigates the 4 failing tests with visible browser and detailed screenshots.

Failures to investigate:
1. Repairs API - 500 server error
2. External Facilities API - timeout
3. Fulfillment Dispatches API - timeout
4. Revenue cards present - UI element missing
"""

from playwright.sync_api import sync_playwright
from test_utils import (
    login, APIClient, TestReporter, take_screenshot,
    navigate_to, wait_for_page_load, BASE_URL, API_URL
)
import requests
import json
import os
import traceback
from datetime import datetime

# Create diagnostic screenshots directory
DIAG_DIR = "screenshots/diagnostics"
os.makedirs(DIAG_DIR, exist_ok=True)

def investigate_api_failure(api: APIClient, endpoint: str, name: str, timeout: int = 30):
    """Deep investigation of an API endpoint failure"""
    result = {
        'name': name,
        'endpoint': endpoint,
        'status': None,
        'error': None,
        'response_time': None,
        'response_body': None,
        'headers': None
    }

    print(f"\n{'='*60}")
    print(f"INVESTIGATING: {name}")
    print(f"Endpoint: {API_URL}{endpoint}")
    print(f"{'='*60}")

    try:
        import time
        start = time.time()
        response = api.get(endpoint, timeout=timeout)
        elapsed = time.time() - start

        result['status'] = response.status_code
        result['response_time'] = f"{elapsed:.2f}s"
        result['headers'] = dict(response.headers)

        print(f"Status: {response.status_code}")
        print(f"Response Time: {elapsed:.2f}s")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")

        try:
            body = response.json()
            result['response_body'] = body
            print(f"Response Body (first 500 chars):")
            print(json.dumps(body, indent=2)[:500])
        except:
            result['response_body'] = response.text[:500]
            print(f"Raw Response (first 500 chars):")
            print(response.text[:500])

        if response.status_code >= 400:
            print(f"\n⚠️  ERROR ANALYSIS:")
            if response.status_code == 500:
                print("   Server-side error - check backend logs")
            elif response.status_code == 404:
                print("   Endpoint not found - route may not be implemented")
            elif response.status_code == 403:
                print("   Permission denied - check user role")

    except requests.exceptions.Timeout as e:
        result['error'] = f"Timeout after {timeout}s"
        print(f"❌ TIMEOUT: Request took longer than {timeout}s")
        print(f"   Possible causes:")
        print(f"   - Endpoint is performing heavy computation")
        print(f"   - Database query is slow")
        print(f"   - Infinite loop in backend")
        print(f"   - Service dependency unavailable")

    except Exception as e:
        result['error'] = str(e)
        print(f"❌ ERROR: {e}")
        traceback.print_exc()

    return result


def investigate_ui_failure(page, url: str, name: str, selectors_to_check: list):
    """Deep investigation of a UI element failure"""
    result = {
        'name': name,
        'url': url,
        'page_loaded': False,
        'screenshot': None,
        'elements_found': {},
        'page_content_summary': None,
        'errors_on_page': []
    }

    print(f"\n{'='*60}")
    print(f"INVESTIGATING UI: {name}")
    print(f"URL: {url}")
    print(f"{'='*60}")

    try:
        # Navigate to page
        page.goto(url)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)  # Extra time for React

        result['page_loaded'] = True
        print(f"✅ Page loaded successfully")
        print(f"Final URL: {page.url}")

        # Take full page screenshot
        screenshot_path = os.path.join(DIAG_DIR, f"diag_{name.lower().replace(' ', '_')}.png")
        page.screenshot(path=screenshot_path, full_page=True)
        result['screenshot'] = screenshot_path
        print(f"📸 Screenshot saved: {screenshot_path}")

        # Check for error messages on page
        error_selectors = [
            '.error', '.alert-danger', '.alert-error',
            '[class*="error"]', '[class*="Error"]',
            'text=Error', 'text=error', 'text=failed'
        ]
        for sel in error_selectors:
            try:
                errors = page.locator(sel).all_text_contents()
                if errors:
                    result['errors_on_page'].extend(errors[:3])
            except:
                pass

        if result['errors_on_page']:
            print(f"⚠️  Errors found on page: {result['errors_on_page'][:3]}")

        # Check each selector
        print(f"\nChecking {len(selectors_to_check)} selectors:")
        for selector_info in selectors_to_check:
            sel = selector_info['selector']
            desc = selector_info['description']

            try:
                count = page.locator(sel).count()
                result['elements_found'][desc] = {
                    'selector': sel,
                    'count': count,
                    'found': count > 0
                }

                status = "✅" if count > 0 else "❌"
                print(f"  {status} {desc}: {count} found (selector: {sel})")

                # If not found, try alternative selectors
                if count == 0:
                    alternatives = find_similar_elements(page, sel, desc)
                    if alternatives:
                        print(f"      💡 Similar elements found: {alternatives}")
                        result['elements_found'][desc]['alternatives'] = alternatives

            except Exception as e:
                result['elements_found'][desc] = {'error': str(e)}
                print(f"  ❌ {desc}: Error - {e}")

        # Get page content summary
        try:
            body_text = page.locator('body').inner_text()
            result['page_content_summary'] = body_text[:1000]

            # Look for key indicators
            print(f"\nPage Content Analysis:")
            if 'loading' in body_text.lower():
                print("  ⚠️  Page may still be loading")
            if 'no data' in body_text.lower() or 'aucun' in body_text.lower():
                print("  ℹ️  Page indicates no data available")
            if 'unauthorized' in body_text.lower() or 'forbidden' in body_text.lower():
                print("  ⚠️  Authorization issue detected")

        except:
            pass

    except Exception as e:
        result['error'] = str(e)
        print(f"❌ Failed to load page: {e}")
        traceback.print_exc()

        # Try to take screenshot anyway
        try:
            screenshot_path = os.path.join(DIAG_DIR, f"diag_{name.lower().replace(' ', '_')}_error.png")
            page.screenshot(path=screenshot_path)
            result['screenshot'] = screenshot_path
        except:
            pass

    return result


def find_similar_elements(page, original_selector: str, description: str):
    """Try to find similar elements when the expected one isn't found"""
    alternatives = []

    # Try common patterns
    if 'card' in original_selector.lower() or 'card' in description.lower():
        for alt in ['.card', '[class*="card"]', '.stat-card', '.dashboard-card', '.metric-card']:
            try:
                count = page.locator(alt).count()
                if count > 0:
                    alternatives.append(f"{alt}: {count} found")
            except:
                pass

    if 'revenue' in description.lower() or 'financial' in description.lower():
        for keyword in ['revenue', 'recette', 'chiffre', 'montant', 'total', 'financial']:
            try:
                count = page.get_by_text(keyword, exact=False).count()
                if count > 0:
                    alternatives.append(f"text='{keyword}': {count} found")
            except:
                pass

    return alternatives[:5]


def check_backend_route_exists(endpoint: str):
    """Check if a backend route is actually defined"""
    print(f"\n🔍 Checking if route is implemented in backend...")

    # Common route file locations
    route_files = [
        '/Users/xtm888/magloire/backend/routes/repairs.js',
        '/Users/xtm888/magloire/backend/routes/externalFacilities.js',
        '/Users/xtm888/magloire/backend/routes/external-facilities.js',
        '/Users/xtm888/magloire/backend/routes/dispatches.js',
        '/Users/xtm888/magloire/backend/routes/fulfillment.js',
    ]

    for rf in route_files:
        if os.path.exists(rf):
            print(f"  ✅ Route file exists: {rf}")
            return True

    print(f"  ❌ No dedicated route file found")
    return False


def run_diagnostic_tests():
    """Main diagnostic test runner"""
    print("\n" + "="*70)
    print("   MEDFLOW FAILURE DIAGNOSTIC INVESTIGATION")
    print("   " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*70)

    findings = {
        'timestamp': datetime.now().isoformat(),
        'api_failures': [],
        'ui_failures': [],
        'recommendations': []
    }

    # Initialize API client
    print("\n📡 Initializing API client...")
    api = APIClient('admin')

    # =========================================================================
    # PART 1: API FAILURE INVESTIGATIONS
    # =========================================================================
    print("\n" + "="*70)
    print("PART 1: API FAILURE INVESTIGATIONS")
    print("="*70)

    api_tests = [
        {
            'name': 'Repairs API',
            'endpoint': '/api/repairs',
            'timeout': 30,
            'expected_issue': '500 Server Error'
        },
        {
            'name': 'External Facilities API',
            'endpoint': '/api/external-facilities',
            'timeout': 30,
            'expected_issue': 'Timeout'
        },
        {
            'name': 'Fulfillment Dispatches API',
            'endpoint': '/api/fulfillment/dispatches',
            'timeout': 30,
            'expected_issue': 'Timeout'
        }
    ]

    for test in api_tests:
        result = investigate_api_failure(
            api,
            test['endpoint'],
            test['name'],
            test['timeout']
        )
        result['expected_issue'] = test['expected_issue']
        findings['api_failures'].append(result)

        # Try alternative endpoints
        if result.get('error') or (result.get('status') and result['status'] >= 400):
            print(f"\n🔄 Trying alternative endpoints...")
            alternatives = [
                test['endpoint'].replace('-', ''),
                test['endpoint'].replace('/', '/api/v1/'),
                test['endpoint'] + '/list',
                test['endpoint'] + '/all'
            ]
            for alt in alternatives:
                try:
                    resp = api.get(alt, timeout=10)
                    if resp.status_code < 400:
                        print(f"  ✅ Alternative works: {alt} (status: {resp.status_code})")
                        result['working_alternative'] = alt
                        break
                except:
                    pass

    # =========================================================================
    # PART 2: UI FAILURE INVESTIGATIONS
    # =========================================================================
    print("\n" + "="*70)
    print("PART 2: UI FAILURE INVESTIGATIONS")
    print("="*70)

    # Launch visible browser for UI testing
    print("\n🌐 Launching visible browser...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # Login first
        print("🔐 Logging in as admin...")
        login(page, 'admin')
        page.wait_for_timeout(2000)

        # Investigate Financial/Revenue cards
        ui_tests = [
            {
                'name': 'Financial Dashboard Revenue Cards',
                'url': f'{BASE_URL}/financial',
                'selectors': [
                    {'selector': '.stat-card', 'description': 'Stat cards'},
                    {'selector': '[class*="card"]', 'description': 'Any cards'},
                    {'selector': '[class*="revenue"]', 'description': 'Revenue elements'},
                    {'selector': '[class*="recette"]', 'description': 'Recette elements (FR)'},
                    {'selector': '.dashboard-stat', 'description': 'Dashboard stats'},
                    {'selector': '[class*="metric"]', 'description': 'Metric elements'},
                    {'selector': '[class*="kpi"]', 'description': 'KPI elements'},
                    {'selector': 'h1, h2, h3', 'description': 'Headings'},
                    {'selector': '.MuiCard-root', 'description': 'MUI Cards'},
                    {'selector': '.ant-card', 'description': 'Ant Design Cards'},
                ]
            },
            {
                'name': 'Financial Dashboard Alternative',
                'url': f'{BASE_URL}/financial-dashboard',
                'selectors': [
                    {'selector': '.stat-card', 'description': 'Stat cards'},
                    {'selector': '[class*="card"]', 'description': 'Any cards'},
                    {'selector': '[class*="Chart"]', 'description': 'Chart elements'},
                ]
            },
            {
                'name': 'Invoicing Page',
                'url': f'{BASE_URL}/invoicing',
                'selectors': [
                    {'selector': '[class*="revenue"]', 'description': 'Revenue elements'},
                    {'selector': '[class*="total"]', 'description': 'Total elements'},
                    {'selector': 'table', 'description': 'Data tables'},
                    {'selector': '.invoice-stats', 'description': 'Invoice stats'},
                ]
            }
        ]

        for test in ui_tests:
            result = investigate_ui_failure(
                page,
                test['url'],
                test['name'],
                test['selectors']
            )
            findings['ui_failures'].append(result)
            page.wait_for_timeout(1000)

        # Take screenshots of related pages for context
        print("\n📸 Capturing additional context screenshots...")
        additional_pages = [
            ('/dashboard', 'Main Dashboard'),
            ('/analytics', 'Analytics'),
            ('/billing/statistics', 'Billing Statistics'),
        ]

        for path, name in additional_pages:
            try:
                page.goto(f'{BASE_URL}{path}')
                page.wait_for_load_state("networkidle", timeout=10000)
                page.wait_for_timeout(1500)
                screenshot_path = os.path.join(DIAG_DIR, f"context_{name.lower().replace(' ', '_')}.png")
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"  📸 {name}: {screenshot_path}")
            except Exception as e:
                print(f"  ❌ {name}: {e}")

        browser.close()

    # =========================================================================
    # PART 3: GENERATE RECOMMENDATIONS
    # =========================================================================
    print("\n" + "="*70)
    print("PART 3: ANALYSIS & RECOMMENDATIONS")
    print("="*70)

    recommendations = []

    # Analyze API failures
    for api_fail in findings['api_failures']:
        if api_fail.get('status') == 500:
            recommendations.append({
                'issue': f"{api_fail['name']} returns 500 error",
                'severity': 'HIGH',
                'recommendation': 'Check backend logs for stack trace. Likely database query error or missing dependency.',
                'action': f"Run: tail -100 /path/to/backend/logs | grep -i error"
            })
        elif api_fail.get('error') and 'timeout' in api_fail.get('error', '').lower():
            recommendations.append({
                'issue': f"{api_fail['name']} times out",
                'severity': 'MEDIUM',
                'recommendation': 'Endpoint may have performance issues or infinite loop. Consider adding database indexes or pagination.',
                'action': f"Profile the {api_fail['endpoint']} route handler"
            })

    # Analyze UI failures
    for ui_fail in findings['ui_failures']:
        missing_elements = [k for k, v in ui_fail.get('elements_found', {}).items()
                          if isinstance(v, dict) and not v.get('found')]
        if missing_elements:
            recommendations.append({
                'issue': f"Missing UI elements on {ui_fail['name']}: {', '.join(missing_elements[:3])}",
                'severity': 'LOW',
                'recommendation': 'UI components may use different class names or structure than expected.',
                'action': 'Review React component implementation and update test selectors'
            })

    findings['recommendations'] = recommendations

    # Print recommendations
    print("\n📋 RECOMMENDATIONS:")
    for i, rec in enumerate(recommendations, 1):
        severity_icon = {'HIGH': '🔴', 'MEDIUM': '🟡', 'LOW': '🟢'}.get(rec['severity'], '⚪')
        print(f"\n{i}. {severity_icon} [{rec['severity']}] {rec['issue']}")
        print(f"   💡 {rec['recommendation']}")
        print(f"   🔧 {rec['action']}")

    # =========================================================================
    # SAVE FINDINGS
    # =========================================================================
    report_path = "failure_diagnostic_report.json"
    with open(report_path, 'w') as f:
        json.dump(findings, f, indent=2, default=str)

    print(f"\n📄 Full diagnostic report saved to: {report_path}")
    print(f"📸 Screenshots saved to: {DIAG_DIR}/")

    # List all screenshots
    print("\n📸 Screenshots captured:")
    for f in sorted(os.listdir(DIAG_DIR)):
        if f.endswith(('.png', '.jpg')):
            print(f"   - {DIAG_DIR}/{f}")

    return findings


if __name__ == '__main__':
    run_diagnostic_tests()
