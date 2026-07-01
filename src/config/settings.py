"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _split_csv(value: str | None, default: list[str]) -> list[str]:
    if not value or not value.strip():
        return default
    return [part.strip() for part in value.split(",") if part.strip()]


@dataclass(frozen=True)
class Settings:
    """Runtime settings for CLI and web services."""

    repo_root: Path = field(default_factory=_repo_root)
    google_api_key: str | None = field(
        default_factory=lambda: os.environ.get("GOOGLE_API_KEY") or None
    )
    output_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("AVE_OUTPUT_DIR", str(_repo_root() / "output"))
        ).expanduser()
    )
    log_level: str = field(
        default_factory=lambda: os.environ.get("AVE_LOG_LEVEL", "INFO").upper()
    )
    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.environ.get("AVE_CORS_ORIGINS"),
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )
    )
    browse_roots: list[Path] = field(
        default_factory=lambda: [
            Path(p).expanduser().resolve()
            for p in _split_csv(
                os.environ.get("AVE_BROWSE_ROOTS"),
                [str(Path.home())],
            )
        ]
    )
    redis_url: str | None = field(
        default_factory=lambda: os.environ.get("REDIS_URL") or None
    )
    redis_key_prefix: str = field(
        default_factory=lambda: os.environ.get("REDIS_KEY_PREFIX", "ave:")
    )
    redis_enabled: bool = field(
        default_factory=lambda: os.environ.get("REDIS_ENABLED", "true").lower()
        in ("1", "true", "yes")
    )

    def ensure_output_dir(self) -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        return self.output_dir


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return cached settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings() -> None:
    """Reset cached settings (for tests)."""
    global _settings
    _settings = None
