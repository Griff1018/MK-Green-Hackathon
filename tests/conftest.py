"""Tests never fetch live trend data: the daily background refresh is switched off."""
import os

os.environ["AUTO_REFRESH"] = "0"
