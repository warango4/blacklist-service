from blacklist.version import is_stable


def test_is_stable_returns_true_for_versions_from_1_0_0():
    assert is_stable("1.0.5") is True


def test_is_stable_returns_false_for_versions_before_1_0_0():
    assert is_stable("0.9.0") is False
