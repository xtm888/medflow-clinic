#!/usr/bin/env python3
"""
Seed Test Data Runner
Calls Node.js seed scripts and loads results for E2E tests
"""

import subprocess
import json
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent.parent / 'backend'
SCRIPTS_DIR = BACKEND_DIR / 'scripts'


def run_seed_script(script_name: str) -> dict:
    """Run a Node.js seed script and return its output"""
    script_path = SCRIPTS_DIR / script_name

    if not script_path.exists():
        return {'success': False, 'error': f'Script not found: {script_path}'}

    try:
        result = subprocess.run(
            ['node', str(script_path)],
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            return {
                'success': False,
                'error': result.stderr or 'Script failed',
                'stdout': result.stdout
            }

        return {'success': True, 'stdout': result.stdout}
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Script timeout'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def load_seed_output(filename: str) -> dict:
    """Load seed script output from temp file"""
    filepath = f'/tmp/{filename}'
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'success': False, 'error': f'Output file not found: {filepath}'}
    except json.JSONDecodeError:
        return {'success': False, 'error': 'Invalid JSON in output file'}


def seed_queue() -> dict:
    """Seed queue with test patients"""
    print("Seeding queue data...")
    result = run_seed_script('seedTestQueue.js')

    if result['success']:
        return load_seed_output('medflow_test_queue.json')
    return result


def seed_appointments() -> dict:
    """Seed test appointments"""
    print("Seeding appointment data...")
    result = run_seed_script('seedTestAppointments.js')

    if result['success']:
        return load_seed_output('medflow_test_appointments.json')
    return result


def seed_all() -> dict:
    """Seed all test data"""
    results = {
        'queue': seed_queue(),
        'appointments': seed_appointments()
    }

    results['success'] = all(r.get('success', False) for r in results.values())
    return results


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == 'queue':
            result = seed_queue()
        elif sys.argv[1] == 'appointments':
            result = seed_appointments()
        else:
            result = seed_all()
    else:
        result = seed_all()

    print(json.dumps(result, indent=2))
