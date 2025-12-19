"""
Test broken pages - Glasses Orders and Templates
Uses form-based login like the working comprehensive test
"""
from playwright.sync_api import sync_playwright
import json
import os

# Configuration
BASE_URL = os.getenv('BASE_URL', 'http://localhost:5173')
API_URL = os.getenv('API_URL', 'http://localhost:5001')
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

def login(page, base_url):
    """Login using the form - with debugging"""
    # Capture console logs
    console_messages = []
    page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))

    # Capture network failures
    failed_requests = []
    page.on("requestfailed", lambda req: failed_requests.append(f"{req.url}: {req.failure}"))

    page.goto(f"{base_url}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)  # Extra wait for React hydration

    # Debug: Check if elements exist
    email_count = page.locator('#email').count()
    pwd_count = page.locator('#password').count()
    print(f'Found {email_count} email inputs, {pwd_count} password inputs')

    # Try input[type="email"] as alternative
    if email_count == 0:
        email_count = page.locator('input[type="email"]').count()
        print(f'Alternative: found {email_count} email inputs via type selector')

    # Use clear first, then type character by character for React controlled inputs
    email_input = page.locator('#email')
    pwd_input = page.locator('#password')

    # Click and type for React controlled inputs
    email_input.click()
    email_input.fill(TEST_USER)
    page.wait_for_timeout(200)

    pwd_input.click()
    pwd_input.fill(TEST_PASSWORD)
    page.wait_for_timeout(200)

    # Debug: screenshot before submit
    page.screenshot(path='screenshots/before_submit.jpg', quality=60, type='jpeg')

    # Click submit
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(2000)  # Wait for submission

    # Debug: check for error message
    error_visible = page.locator('.bg-red-50').count() > 0
    if error_visible:
        error_text = page.locator('.bg-red-50').inner_text()
        print(f'Login error: {error_text}')

    try:
        page.wait_for_url("**/home", timeout=10000)
        print('Login successful - redirected to /home')
        return True
    except:
        # Check current URL
        current_url = page.url
        print(f'Login redirect failed - current URL: {current_url}')
        page.screenshot(path='screenshots/login_failure.jpg', quality=60, type='jpeg')

        # Print console errors
        errors = [m for m in console_messages if 'error' in m.lower()]
        if errors:
            print(f'Console errors: {errors[:5]}')

        # Print failed requests
        if failed_requests:
            print(f'Failed requests: {failed_requests[:5]}')

        if '/login' not in current_url:
            return True  # May have redirected to dashboard instead
        return False

def test_broken_pages():
    os.makedirs('screenshots', exist_ok=True)
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # Login first
        if not login(page, BASE_URL):
            print('ERROR: Login failed!')
            page.screenshot(path='screenshots/login_failure.jpg', quality=60, type='jpeg')
            browser.close()
            return []

        print(f'Logged in - current URL: {page.url}')

        # Test Glasses Orders page
        try:
            page.goto(f'{BASE_URL}/glasses-orders', timeout=15000)
            page.wait_for_load_state('networkidle', timeout=8000)
            page.wait_for_timeout(2000)

            title = page.title()
            url = page.url
            page.screenshot(path='screenshots/verify_glasses_orders.jpg', quality=60, type='jpeg')

            # Check for common error indicators
            content = page.inner_text('body')
            has_error = '404' in content or 'not found' in content.lower() or 'error' in content.lower()[:100]
            has_data = 'Commandes' in content or 'Orders' in content or 'lunettes' in content.lower()

            results.append({
                'page': 'Glasses Orders',
                'url': url,
                'title': title,
                'has_error': has_error,
                'has_data': has_data,
                'status': 'pass' if (not has_error and '/glasses-orders' in url) else 'fail',
                'content_preview': content[:300]
            })
            print(f'Glasses Orders: {"PASS" if not has_error else "FAIL"}')
        except Exception as e:
            results.append({'page': 'Glasses Orders', 'error': str(e), 'status': 'error'})
            print(f'Glasses Orders ERROR: {e}')

        # Test Templates page
        try:
            page.goto(f'{BASE_URL}/templates', timeout=15000)
            page.wait_for_load_state('networkidle', timeout=8000)
            page.wait_for_timeout(2000)

            title = page.title()
            url = page.url
            page.screenshot(path='screenshots/verify_templates.jpg', quality=60, type='jpeg')

            # Check for common error indicators
            content = page.inner_text('body')
            has_error = '404' in content or 'not found' in content.lower() or 'error' in content.lower()[:100]
            has_data = 'Template' in content or 'Modèle' in content

            results.append({
                'page': 'Templates',
                'url': url,
                'title': title,
                'has_error': has_error,
                'has_data': has_data,
                'status': 'pass' if (not has_error and '/templates' in url) else 'fail',
                'content_preview': content[:300]
            })
            print(f'Templates: {"PASS" if not has_error else "FAIL"}')
        except Exception as e:
            results.append({'page': 'Templates', 'error': str(e), 'status': 'error'})
            print(f'Templates ERROR: {e}')

        browser.close()

    # Save results
    with open('broken_pages_report.json', 'w') as f:
        json.dump({'results': results}, f, indent=2)

    print('\n=== RESULTS ===')
    for r in results:
        print(json.dumps(r, indent=2))

    return results

if __name__ == '__main__':
    test_broken_pages()
