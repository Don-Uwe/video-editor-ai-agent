"""Filesystem directory browser for the studio UI."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from src.config import get_settings

router = APIRouter(prefix="/api/browse", tags=["browse"])

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv"}


def _is_within_roots(target: Path, roots: list[Path]) -> bool:
    for root in roots:
        try:
            target.relative_to(root)
            return True
        except ValueError:
            continue
    return False


@router.get("")
async def browse_directory(
    path: str = Query(default="~", description="Absolute path to list"),
) -> dict:
    """List subdirectories and video files at the given path."""
    settings = get_settings()
    target = Path(path).expanduser().resolve()

    if not _is_within_roots(target, settings.browse_roots):
        raise HTTPException(
            status_code=403,
            detail="Path is outside configured browse roots",
        )

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {target}")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {target}")

    dirs: list[dict] = []
    files: list[dict] = []

    try:
        for entry in sorted(target.iterdir(), key=lambda e: e.name.lower()):
            # Skip hidden files/dirs.
            if entry.name.startswith("."):
                continue
            if entry.is_dir():
                dirs.append({"name": entry.name, "path": str(entry), "type": "dir"})
            elif entry.suffix.lower() in VIDEO_EXTS:
                files.append({"name": entry.name, "path": str(entry), "type": "file"})
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {target}")

    return {
        "current": str(target),
        "parent": str(target.parent) if target.parent != target else None,
        "dirs": dirs,
        "files": files,
        "video_count": len(files),
    }
