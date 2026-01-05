"""
Quick validation test for critical fixes
"""
import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5173"
ADMIN_EMAIL = "admin@medflow.com"
ADMIN_PASSWORD = "MedFlow$ecure1"

results = []

async def login(page):
    """Quick login"""
    await page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(1000)

    await page.locator('input[type="email"]').first.fill(ADMIN_EMAIL)
    await page.locator('input[type="password"]').first.fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()

    try:
        await page.wait_for_url(lambda url: "/login" not in url, timeout=15000)
        return True
    except:
        await page.wait_for_timeout(3000)
        return "/login" not in page.url

async def test_login(page):
    """Test login works"""
    print("Test 1: Login...")
    success = await login(page)
    print(f"  {'✅ PASSED' if success else '❌ FAILED'}")
    results.append(("Login", success))
    return success

async def test_settings_page(page):
    """Test settings page loads"""
    print("Test 2: Settings page...")
    await page.goto(f"{BASE_URL}/settings", wait_until="networkidle")
    await page.wait_for_timeout(1000)

    success = "/login" not in page.url and await page.locator('nav button').count() > 0
    print(f"  {'✅ PASSED' if success else '❌ FAILED'}")
    results.append(("Settings Page", success))
    return success

async def test_users_navigation(page):
    """Test BUG-002 fix: Users navigation from settings"""
    print("Test 3: Users navigation from Settings (BUG-002 fix)...")
    await page.goto(f"{BASE_URL}/settings", wait_until="networkidle")
    await page.wait_for_timeout(1000)

    users_btn = page.locator('button:has-text("Utilisateurs"), nav button:has-text("Utilisateurs")')
    if await users_btn.count() > 0:
        await users_btn.first.click()
        await page.wait_for_timeout(2000)
        success = "/users" in page.url
        print(f"  {'✅ PASSED' if success else '❌ FAILED'} - URL: {page.url}")
    else:
        success = False
        print(f"  ❌ FAILED - Users button not found")

    results.append(("Users Navigation", success))
    return success

async def test_glasses_orders(page):
    """Test BUG-001 fix: Glasses orders page"""
    print("Test 4: Glasses orders page (BUG-001 fix)...")
    await page.goto(f"{BASE_URL}/glasses-orders", wait_until="networkidle")
    await page.wait_for_timeout(1000)

    # Check no error message
    has_error = await page.locator('text=Erreur').count() > 0
    success = not has_error and "/login" not in page.url
    print(f"  {'✅ PASSED' if success else '❌ FAILED'}")
    results.append(("Glasses Orders", success))
    return success

async def test_dashboard(page):
    """Test dashboard loads"""
    print("Test 5: Dashboard...")
    await page.goto(f"{BASE_URL}/", wait_until="networkidle")
    await page.wait_for_timeout(1000)

    success = "/login" not in page.url and await page.locator('main').count() > 0
    print(f"  {'✅ PASSED' if success else '❌ FAILED'}")
    results.append(("Dashboard", success))
    return success

async def test_audit_route(page):
    """Test audit route (NEW FIX)"""
    print("Test 6: Audit Trail route...")
    await page.goto(f"{BASE_URL}/audit", wait_until="networkidle")
    await page.wait_for_timeout(1000)

    # Should not be 404
    is_404 = await page.locator('text=404').count() > 0 or await page.locator('text=introuvable').count() > 0
    success = not is_404 and "/login" not in page.url
    print(f"  {'✅ PASSED' if success else '❌ FAILED'}")
    results.append(("Audit Route", success))
    return success

async def test_financial_reports_route(page):
    """Test financial-reports route (NEW FIX)"""
    print("Test 7: Financial Reports route...")
    await page.goto(f"{BASE_URL}/financial-reports", wait_until="networkidle")
    await page.wait_for_timeout(1000)

    # Should not be 404
    is_404 = await page.locator('text=404').count() > 0 or await page.locator('text=introuvable').count() > 0
    success = not is_404 and "/login" not in page.url
    print(f"  {'✅ PASSED' if success else '❌ FAILED'}")
    results.append(("Financial Reports Route", success))
    return success

async def run_tests():
    """Run quick validation tests"""
    print("\n" + "="*50)
    print("MedFlow Quick Validation Tests")
    print("="*50 + "\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="fr-FR"
        )
        page = await context.new_page()

        # Run tests
        await test_login(page)
        await test_settings_page(page)
        await test_users_navigation(page)
        await test_glasses_orders(page)
        await test_dashboard(page)
        await test_audit_route(page)
        await test_financial_reports_route(page)

        await browser.close()

    # Summary
    passed = sum(1 for _, s in results if s)
    total = len(results)

    print("\n" + "="*50)
    print(f"RESULTS: {passed}/{total} passed ({(passed/total)*100:.0f}%)")
    print("="*50)

    return passed == total

if __name__ == "__main__":
    success = asyncio.run(run_tests())
    exit(0 if success else 1)
