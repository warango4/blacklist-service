"""Versión del microservicio. Se incrementa en cada despliegue (ver CHANGELOG.md)."""
__version__ = "1.0.5"


def is_stable(version: str) -> bool:
    """Indica si una versión es estable (mayor o igual a 1.0.0)."""
    return not version.startswith("0.")
