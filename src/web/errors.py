"""Shared HTTP and validation error helpers."""

from __future__ import annotations

from fastapi import HTTPException


def not_found(resource: str, identifier: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} not found: {identifier}")


def conflict(message: str) -> HTTPException:
    return HTTPException(status_code=409, detail=message)


def validation_error(message: str) -> HTTPException:
    return HTTPException(status_code=422, detail=message)
