#!/usr/bin/env python3
"""
Master Comprehensive Test Runner
================================

Runs all comprehensive module tests and generates a unified report.
Tests covered:
- Optical (glasses orders, inventory)
- Surgery (cases, workflow)
- Laboratory (orders, QC)
- Queue & Appointments

Usage:
    python run_comprehensive_tests.py           # Run all tests headless
    HEADED=1 python run_comprehensive_tests.py  # Run with visible browser
    python run_comprehensive_tests.py --parallel  # Run tests in parallel

Author: MedFlow Test Automation
Created: 2025-12-28
"""
import os
import sys
import json
import time
import argparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import test classes
from test_optical_comprehensive import OpticalComprehensiveTest
from test_surgery_comprehensive import SurgeryComprehensiveTest
from test_laboratory_comprehensive import LaboratoryComprehensiveTest
from test_queue_appointments_comprehensive import QueueAppointmentsComprehensiveTest


# =============================================================================
# CONFIGURATION
# =============================================================================

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'screenshots', 'comprehensive')

TEST_MODULES = {
    'optical': {
        'class': OpticalComprehensiveTest,
        'name': 'Optical Module',
        'description': 'Glasses orders, frames, lenses inventory'
    },
    'surgery': {
        'class': SurgeryComprehensiveTest,
        'name': 'Surgery Module',
        'description': 'Surgery cases, scheduling, workflow'
    },
    'laboratory': {
        'class': LaboratoryComprehensiveTest,
        'name': 'Laboratory Module',
        'description': 'Lab orders, results, QC rules'
    },
    'queue': {
        'class': QueueAppointmentsComprehensiveTest,
        'name': 'Queue & Appointments',
        'description': 'Patient queue, appointments, scheduling'
    }
}


# =============================================================================
# TEST RUNNER
# =============================================================================

class ComprehensiveTestRunner:
    """Runs all comprehensive tests and generates unified report"""

    def __init__(self, modules: List[str] = None, parallel: bool = False):
        self.modules = modules or list(TEST_MODULES.keys())
        self.parallel = parallel
        self.results: Dict[str, Dict] = {}
        self.start_time = datetime.now()

    def run_single_test(self, module_key: str) -> Tuple[str, Dict]:
        """Run a single module test"""
        module_info = TEST_MODULES.get(module_key)
        if not module_info:
            return module_key, {'error': f'Unknown module: {module_key}'}

        print(f"\n{'='*70}")
        print(f"🔬 Running: {module_info['name']}")
        print(f"   {module_info['description']}")
        print(f"{'='*70}")

        try:
            test = module_info['class']()
            report = test.run()
            return module_key, report
        except Exception as e:
            return module_key, {
                'error': str(e),
                'summary': {'total_steps': 0, 'passed': 0, 'failed': 1}
            }

    def run_all_sequential(self) -> Dict[str, Dict]:
        """Run all tests sequentially"""
        for module_key in self.modules:
            key, report = self.run_single_test(module_key)
            self.results[key] = report
        return self.results

    def run_all_parallel(self) -> Dict[str, Dict]:
        """Run all tests in parallel"""
        with ThreadPoolExecutor(max_workers=len(self.modules)) as executor:
            futures = {
                executor.submit(self.run_single_test, module_key): module_key
                for module_key in self.modules
            }

            for future in as_completed(futures):
                module_key = futures[future]
                try:
                    key, report = future.result()
                    self.results[key] = report
                except Exception as e:
                    self.results[module_key] = {
                        'error': str(e),
                        'summary': {'total_steps': 0, 'passed': 0, 'failed': 1}
                    }

        return self.results

    def run(self) -> Dict:
        """Run all tests and generate unified report"""
        print("\n" + "=" * 70)
        print("🚀 MEDFLOW COMPREHENSIVE E2E TEST SUITE")
        print("=" * 70)
        print(f"Modules to test: {', '.join(self.modules)}")
        print(f"Parallel mode: {self.parallel}")
        print(f"Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        if self.parallel:
            self.run_all_parallel()
        else:
            self.run_all_sequential()

        return self.generate_unified_report()

    def generate_unified_report(self) -> Dict:
        """Generate unified report from all module results"""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()

        # Calculate totals
        total_steps = 0
        total_passed = 0
        total_failed = 0
        module_summaries = {}

        for module_key, report in self.results.items():
            summary = report.get('summary', {})
            steps = summary.get('total_steps', 0)
            passed = summary.get('passed', 0)
            failed = summary.get('failed', 0)

            if report.get('error'):
                failed += 1

            total_steps += steps
            total_passed += passed
            total_failed += failed

            module_summaries[module_key] = {
                'name': TEST_MODULES.get(module_key, {}).get('name', module_key),
                'steps': steps,
                'passed': passed,
                'failed': failed,
                'pass_rate': f"{(passed/steps*100):.1f}%" if steps > 0 else "N/A",
                'error': report.get('error')
            }

        # Build unified report
        unified_report = {
            'title': 'MedFlow Comprehensive E2E Test Report',
            'start_time': self.start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': duration,
            'overall_summary': {
                'total_modules': len(self.modules),
                'total_steps': total_steps,
                'total_passed': total_passed,
                'total_failed': total_failed,
                'pass_rate': f"{(total_passed/total_steps*100):.1f}%" if total_steps > 0 else "N/A"
            },
            'module_summaries': module_summaries,
            'module_reports': self.results
        }

        # Save unified report
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        report_path = os.path.join(OUTPUT_DIR, 'unified_report.json')
        with open(report_path, 'w') as f:
            json.dump(unified_report, f, indent=2, default=str)

        # Generate markdown summary
        self._generate_markdown_summary(unified_report)

        # Print summary
        self._print_summary(unified_report)

        return unified_report

    def _generate_markdown_summary(self, report: Dict):
        """Generate markdown summary report"""
        md_path = os.path.join(OUTPUT_DIR, 'COMPREHENSIVE_TEST_REPORT.md')

        with open(md_path, 'w') as f:
            f.write("# MedFlow Comprehensive E2E Test Report\n\n")
            f.write(f"**Date:** {report['start_time'][:10]}\n")
            f.write(f"**Duration:** {report['duration_seconds']:.1f}s\n\n")

            # Overall summary
            f.write("## Overall Summary\n\n")
            summary = report['overall_summary']
            overall_status = "✅ PASSED" if summary['total_failed'] == 0 else "❌ FAILED"
            f.write(f"**Status:** {overall_status}\n\n")

            f.write("| Metric | Value |\n")
            f.write("|--------|-------|\n")
            f.write(f"| Modules Tested | {summary['total_modules']} |\n")
            f.write(f"| Total Steps | {summary['total_steps']} |\n")
            f.write(f"| Passed | {summary['total_passed']} |\n")
            f.write(f"| Failed | {summary['total_failed']} |\n")
            f.write(f"| Pass Rate | {summary['pass_rate']} |\n\n")

            # Module summaries
            f.write("## Module Results\n\n")
            f.write("| Module | Steps | Passed | Failed | Pass Rate | Status |\n")
            f.write("|--------|-------|--------|--------|-----------|--------|\n")

            for key, mod in report['module_summaries'].items():
                status = "✅" if mod['failed'] == 0 and not mod.get('error') else "❌"
                f.write(f"| {mod['name']} | {mod['steps']} | {mod['passed']} | {mod['failed']} | {mod['pass_rate']} | {status} |\n")

            f.write("\n")

            # Module details
            f.write("## Module Details\n\n")
            for key, mod in report['module_summaries'].items():
                status = "✅" if mod['failed'] == 0 else "❌"
                f.write(f"### {status} {mod['name']}\n\n")

                if mod.get('error'):
                    f.write(f"**Error:** {mod['error']}\n\n")

                f.write(f"- **Steps:** {mod['steps']}\n")
                f.write(f"- **Passed:** {mod['passed']}\n")
                f.write(f"- **Failed:** {mod['failed']}\n")
                f.write(f"- **Pass Rate:** {mod['pass_rate']}\n\n")

                # Link to module report
                f.write(f"📁 [View detailed report](./{key}/REPORT.md)\n\n")

            # Screenshots link
            f.write("## Screenshots\n\n")
            f.write("Screenshots for each module are available in:\n")
            f.write(f"- `{OUTPUT_DIR}/optical/`\n")
            f.write(f"- `{OUTPUT_DIR}/surgery/`\n")
            f.write(f"- `{OUTPUT_DIR}/laboratory/`\n")
            f.write(f"- `{OUTPUT_DIR}/queueappointments/`\n")

        print(f"\n📄 Markdown report saved to: {md_path}")

    def _print_summary(self, report: Dict):
        """Print summary to console"""
        print("\n" + "=" * 70)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 70)

        summary = report['overall_summary']
        print(f"\nDuration: {report['duration_seconds']:.1f}s")
        print(f"Total Steps: {summary['total_steps']}")
        print(f"Passed: {summary['total_passed']}")
        print(f"Failed: {summary['total_failed']}")
        print(f"Pass Rate: {summary['pass_rate']}")

        print("\n--- Module Results ---")
        for key, mod in report['module_summaries'].items():
            status = "✅" if mod['failed'] == 0 and not mod.get('error') else "❌"
            print(f"  {status} {mod['name']}: {mod['passed']}/{mod['steps']} ({mod['pass_rate']})")

        print(f"\n📁 Reports saved to: {OUTPUT_DIR}")

        # Overall status
        if summary['total_failed'] == 0:
            print("\n✅ ALL TESTS PASSED")
        else:
            print(f"\n❌ {summary['total_failed']} TESTS FAILED")


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Run MedFlow comprehensive E2E tests'
    )
    parser.add_argument(
        '--modules', '-m',
        nargs='+',
        choices=list(TEST_MODULES.keys()),
        help='Specific modules to test (default: all)'
    )
    parser.add_argument(
        '--parallel', '-p',
        action='store_true',
        help='Run tests in parallel'
    )
    parser.add_argument(
        '--headed',
        action='store_true',
        help='Run with visible browser'
    )

    args = parser.parse_args()

    # Set HEADED env var if requested
    if args.headed:
        os.environ['HEADED'] = '1'

    # Run tests
    runner = ComprehensiveTestRunner(
        modules=args.modules,
        parallel=args.parallel
    )
    report = runner.run()

    # Exit with appropriate code
    if report['overall_summary']['total_failed'] > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
