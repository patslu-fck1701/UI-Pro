"""Goethe Hotel: verify the scenario through real API handlers with a throwaway DB.

No Render/production tenant, provider, external contact or new service is used.
"""
import subprocess
import sys
from pathlib import Path


def test_goethe_19_room_eight_person_synthetic_runtime():
    script = Path(__file__).with_name("goethe_runtime_scenarios.py")
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=script.parents[1],
        capture_output=True,
        text=True,
        timeout=90,
    )
    assert result.returncode == 0, result.stdout + "\n" + result.stderr
    assert "PASS GOETHE REAL API + SQLITE" in result.stdout
