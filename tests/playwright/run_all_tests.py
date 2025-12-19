"""
Comprehensive Test Runner for MedFlow
Runs all test suites and generates aggregate report
"""
import os
import sys
import json
from datetime import datetime
from pathlib import Path

# Import all test modules
from test_role_access import run_role_access_tests
from test_multi_clinic import run_multi_clinic_tests
from test_document_generation import run_document_generation_tests
from test_laboratory_workflow import run_laboratory_workflow_tests
from test_billing_calculations import run_billing_calculation_tests
from test_device_integration import run_device_integration_tests


def run_all_tests():
    """Run all test suites and aggregate results"""
    print("\n" + "="*70)
    print("MEDFLOW COMPREHENSIVE E2E TEST SUITE")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    all_results = {}
    total_tests = 0
    total_passed = 0
    total_failed = 0

    # Define test suites
    test_suites = [
        ("Role-Based Access", run_role_access_tests),
        ("Multi-Clinic", run_multi_clinic_tests),
        ("Document Generation", run_document_generation_tests),
        ("Laboratory Workflow", run_laboratory_workflow_tests),
        ("Billing Calculations", run_billing_calculation_tests),
        ("Device Integration", run_device_integration_tests),
    ]

    # Run each test suite
    for name, runner in test_suites:
        print(f"\n{'='*70}")
        print(f"Running: {name}")
        print("="*70)

        try:
            results = runner()
            passed = sum(1 for r in results if r.get('passed', False))
            failed = len(results) - passed

            all_results[name] = {
                "total": len(results),
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{(passed/len(results)*100):.1f}%" if results else "0%",
                "results": results
            }

            total_tests += len(results)
            total_passed += passed
            total_failed += failed

        except Exception as e:
            print(f"ERROR running {name}: {e}")
            all_results[name] = {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "pass_rate": "ERROR",
                "error": str(e)
            }

    # Generate summary
    print("\n" + "="*70)
    print("COMPREHENSIVE TEST SUMMARY")
    print("="*70)

    for suite_name, suite_results in all_results.items():
        status = "✓" if suite_results['failed'] == 0 else "✗"
        print(f"{status} {suite_name}: {suite_results['passed']}/{suite_results['total']} ({suite_results['pass_rate']})")

    print("-"*70)
    overall_rate = f"{(total_passed/total_tests*100):.1f}%" if total_tests > 0 else "0%"
    print(f"TOTAL: {total_passed}/{total_tests} tests passed ({overall_rate})")
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Save aggregate report
    report = {
        "name": "comprehensive_test_suite",
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total": total_tests,
            "passed": total_passed,
            "failed": total_failed,
            "pass_rate": overall_rate
        },
        "suites": all_results
    }

    report_path = "comprehensive_test_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    print(f"\nFull report saved to: {report_path}")

    # Print failed tests summary
    if total_failed > 0:
        print("\n" + "="*70)
        print("FAILED TESTS DETAILS")
        print("="*70)
        for suite_name, suite_results in all_results.items():
            if suite_results.get('failed', 0) > 0:
                print(f"\n{suite_name}:")
                for result in suite_results.get('results', []):
                    if not result.get('passed', False):
                        print(f"  ✗ {result.get('test', 'Unknown')}: {result.get('details', 'No details')}")

    return report


if __name__ == '__main__':
    run_all_tests()
