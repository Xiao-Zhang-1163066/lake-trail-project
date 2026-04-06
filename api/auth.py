"""Authentication and user management."""

from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from jwt import exceptions as jwt_exceptions
import azure.functions as func
from psycopg import errors as psycopg_errors

from config import ADMIN_JWT_SECRET, ADMIN_JWT_EXP_MINUTES, ADMIN_JWT_ALGORITHM
from repositories.core import (
    db_enabled,
    db_fetch_one,
)
from repositories.users import (
    db_row_to_user,
    find_user_by_email,
    find_user_by_id,
    resolve_role,
)
from utils import (
    text_response,
    normalize_email,
    extract_bearer_token,
    utc_now_naive,
)


def hash_password(secret: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(secret.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(secret: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash."""
    if not secret or not hashed:
        return False
    try:
        return bcrypt.checkpw(secret.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def issue_token(user: dict) -> str:
    """Issue a JWT token for a user."""
    if not ADMIN_JWT_SECRET:
        raise ValueError("Admin JWT secret is not configured")
    print(
        "AUTH DEBUG issue_token secret",
        (ADMIN_JWT_SECRET[:4] + "***") if ADMIN_JWT_SECRET else "missing",
        len(ADMIN_JWT_SECRET),
    )
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=max(1, ADMIN_JWT_EXP_MINUTES))
    role = resolve_role(user.get("role"))
    payload = {
        "sub": user.get("id"),
        "email": normalize_email(user.get("email")),
        "name": (user.get("name") or "").strip(),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm=ADMIN_JWT_ALGORITHM)


def sanitize_user(user: dict) -> dict:
    """Remove sensitive fields from user dict."""
    return {
        "id": user.get("id"),
        "email": normalize_email(user.get("email")),
        "name": (user.get("name") or "").strip(),
        "role": resolve_role(user.get("role")),
        "createdAt": user.get("createdAt"),
        "updatedAt": user.get("updatedAt"),
    }


def get_current_user(
    req: func.HttpRequest, require: bool = True
) -> tuple[dict | None, func.HttpResponse | None]:
    """Get the current authenticated user from request."""
    token = extract_bearer_token(req)
    if not token:
        if require:
            return None, text_response("Unauthorized: missing token", status=401)
        return None, None
    if not ADMIN_JWT_SECRET:
        if require:
            return None, text_response("Admin auth not configured", status=500)
        return None, None
    print(
        "AUTH DEBUG get_current_user secret repr",
        repr(ADMIN_JWT_SECRET),
        len(ADMIN_JWT_SECRET),
    )
    try:
        payload = jwt.decode(
            token, ADMIN_JWT_SECRET, algorithms=[ADMIN_JWT_ALGORITHM]
        )
    except jwt_exceptions.PyJWTError as exc:
        secret_repr = repr(ADMIN_JWT_SECRET)
        message = f"Unauthorized: {exc} (secret_repr={secret_repr}, len={len(ADMIN_JWT_SECRET)})"
        if require:
            return None, text_response(message, status=401)
        return None, None
    user_id = payload.get("sub")
    user = find_user_by_id(user_id)
    if not user:
        email_from_token = normalize_email(payload.get("email"))
        if not email_from_token:
            if require:
                return None, text_response("Unauthorized: user not found", status=401)
            return None, None
        # Fallback to JWT payload so that stateless tokens still work if the user record
        # cannot be fetched (e.g. replication lag or external auth user).
        fallback_user = {
            "id": str(user_id) if user_id is not None else None,
            "email": email_from_token,
            "name": (payload.get("name") or "").strip(),
            "role": resolve_role(payload.get("role")),
            "createdAt": None,
            "updatedAt": None,
        }
        return fallback_user, None
    return user, None


def get_current_admin(
    req: func.HttpRequest, require: bool = True
) -> tuple[dict | None, func.HttpResponse | None]:
    """Get the current authenticated admin user from request."""
    user, error = get_current_user(req, require=require)
    if error or not user:
        return user, error
    if resolve_role(user.get("role")) != "admin":
        if require:
            return None, text_response("Forbidden: admin role required", status=403)
        return None, None
    return user, None


def create_user(email: str, password: str, name: str = "") -> dict | None:
    """Create a new user in the database."""
    if not db_enabled():
        raise RuntimeError("User database not configured")

    email = normalize_email(email)
    password_hash = hash_password(password)
    created_at = utc_now_naive()
    
    try:
        row = db_fetch_one(
            "INSERT INTO users (email, name, password_hash, role, created_at, updated_at)"
            " VALUES (%s, %s, %s, %s, %s, %s)"
            " RETURNING id, email, name, password_hash, role, created_at, updated_at",
            (
                email,
                name or None,
                password_hash,
                "volunteer",
                created_at,
                created_at,
            ),
        )
    except psycopg_errors.UniqueViolation:
        raise ValueError("Email is already registered")

    return db_row_to_user(row)
