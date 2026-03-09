"""Shared service-layer errors."""


class AppError(Exception):
    """Application-level error with HTTP-friendly status code."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

