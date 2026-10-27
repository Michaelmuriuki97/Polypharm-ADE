"""SQLite-backed account authentication and branded email notifications."""
from __future__ import annotations

import hashlib
import hmac
import html
import logging
import os
import secrets
import smtplib
import sqlite3
import ssl
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(
    os.getenv("POLYPHARM_AUTH_DB", str(BASE_DIR / "data" / "polypharm_auth.db"))
)
SESSION_COOKIE = "polypharm_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14
RESET_TOKEN_TTL_SECONDS = 30 * 60
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in {
    "1", "true", "yes"
}
PBKDF2_ITERATIONS = 310_000

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_auth_db() -> None:
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_auth_sessions_token "
            "ON auth_sessions(token_hash)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry "
            "ON auth_sessions(expires_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_password_reset_token "
            "ON password_reset_tokens(token_hash)"
        )
        conn.commit()


def _hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        ).hex()
        return hmac.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _public_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def _logo_path() -> Optional[Path]:
    """Find the project logo for embedding directly in email."""
    candidates = (
        BASE_DIR / "frontend" / "public" / "images" / "logo.png",
        BASE_DIR / "frontend" / "images" / "logo.png",
        BASE_DIR / "images" / "logo.png",
    )
    return next((path for path in candidates if path.is_file()), None)


def _email_template(title: str, body_html: str, has_logo: bool) -> str:
    if has_logo:
        brand = """
            <img src="cid:polypharm-logo" alt="Polypharm ADE"
                 width="180"
                 style="display:block;width:180px;max-width:100%;height:auto;
                        margin:0 auto 18px;">
        """
    else:
        brand = """
            <div style="color:#61dfd0;font-size:20px;font-weight:700;
                        margin-bottom:18px;">Polypharm ADE</div>
        """

    return f"""<!doctype html>
<html lang="en">
  <body style="margin:0;padding:28px 12px;background:#0d1228;
               font-family:Arial,Helvetica,sans-serif;color:#f4f6ff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
           style="max-width:600px;margin:0 auto;background:#17213b;
                  border:1px solid #34415f;border-radius:16px;">
      <tr><td style="padding:32px 30px;text-align:center;">
        {brand}
        <h1 style="margin:0;color:#f4f6ff;font-size:24px;line-height:1.3;">
          {title}
        </h1>
      </td></tr>
      <tr><td style="padding:0 30px 30px;color:#dbe5ff;
                     font-size:15px;line-height:1.7;">
        {body_html}
        <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #34415f;
                  color:#aab8d8;font-size:12px;">
          Polypharm ADE · Medication information support
        </p>
      </td></tr>
    </table>
  </body>
</html>"""


def _send_email(
    recipient: str,
    subject: str,
    text_body: str,
    title: str,
    body_html: str,
) -> bool:
    """Send a branded email using SMTP settings from backend/.env."""
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    smtp_from = os.getenv("SMTP_FROM", smtp_user).strip()

    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        logger.error("SMTP_PORT must be a number.")
        return False

    if not all((smtp_host, smtp_user, smtp_password, smtp_from, recipient)):
        logger.warning("Email not sent: SMTP settings are incomplete.")
        return False

    logo_path = _logo_path()
    message = EmailMessage()
    message["From"] = smtp_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(
        _email_template(title, body_html, has_logo=logo_path is not None),
        subtype="html",
    )

    if logo_path:
        try:
            html_part = message.get_body(preferencelist=("html",))
            html_part.add_related(
                logo_path.read_bytes(),
                maintype="image",
                subtype="png",
                cid="<polypharm-logo>",
                filename=logo_path.name,
            )
        except OSError:
            logger.exception("Could not load the Polypharm ADE email logo.")

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(
                smtp_host,
                smtp_port,
                timeout=20,
                context=ssl.create_default_context(),
            ) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(smtp_user, smtp_password)
                server.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        # Don't log SMTP credentials or fail signup if mail delivery fails.
        logger.exception("Could not send email to %s.", recipient)
        return False


def _send_signup_notifications(name: str, email: str, created_at: int) -> dict:
    founder_email = os.getenv("FOUNDER_EMAIL", "").strip()
    site_url = os.getenv(
        "FRONTEND_SITE_URL",
        "http://localhost:5173/clinical-app.html",
    ).strip()
    safe_name = html.escape(name)
    safe_email = html.escape(email)
    safe_site_url = html.escape(site_url, quote=True)
    date_text = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(created_at))

    welcome_sent = _send_email(
        recipient=email,
        subject="Welcome to Polypharm ADE",
        title="Welcome to Polypharm ADE",
        text_body=(
            f"Hello {name},\n\n"
            "Your Polypharm ADE account has been created successfully.\n"
            f"Open the site and sign in again here: {site_url}"
        ),
        body_html=(
            f"<p>Hello {safe_name},</p>"
            "<p>Your Polypharm ADE account has been created successfully.</p>"
            "<p>Use this button to return to the site and sign in:</p>"
            f'<p><a href="{safe_site_url}" style="display:inline-block;'
            "padding:12px 20px;border-radius:10px;background:#61dfd0;"
            'color:#0d1228;font-weight:bold;text-decoration:none;">'
            "Open Polypharm ADE</a></p>"
        ),
    )

    founder_sent = False
    if founder_email:
        founder_sent = _send_email(
            recipient=founder_email,
            subject="New Polypharm ADE account",
            title="A new account was created",
            text_body=(
                "A new account was created on Polypharm ADE.\n\n"
                f"Name: {name}\nEmail: {email}\nCreated: {date_text}\n"
            ),
            body_html=(
                "<p>A new account was created on Polypharm ADE.</p>"
                '<table role="presentation" cellspacing="0" cellpadding="7" '
                'style="border-collapse:collapse;">'
                f"<tr><td><b>Name</b></td><td>{safe_name}</td></tr>"
                f"<tr><td><b>Email</b></td><td>{safe_email}</td></tr>"
                f"<tr><td><b>Created</b></td><td>{html.escape(date_text)}</td></tr>"
                "</table>"
            ),
        )
    else:
        logger.warning("Founder email not sent: FOUNDER_EMAIL is not set.")

    logger.info(
        "Signup notification results: welcome=%s founder=%s",
        welcome_sent,
        founder_sent,
    )
    return {
        "welcome_email_sent": welcome_sent,
        "founder_email_sent": founder_sent,
    }


class SignupPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordPayload(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=10, max_length=128)


class DeleteAccountPayload(BaseModel):
    password: str = Field(min_length=1, max_length=128)


def current_user(polypharm_session: Optional[str] = Cookie(default=None)) -> dict:
    if not polypharm_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to continue.",
        )

    now = int(time.time())
    with connect_db() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.full_name, u.email, u.created_at
            FROM auth_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_token_hash(polypharm_session), now),
        ).fetchone()
        conn.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (now,))
        conn.commit()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session expired. Please log in again.",
        )
    return _public_user(row)


def _create_session(user_id: int, response: Response) -> None:
    token = secrets.token_urlsafe(48)
    now = int(time.time())

    with connect_db() as conn:
        conn.execute(
            """
            INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, _token_hash(token), now + SESSION_TTL_SECONDS, now),
        )
        conn.commit()

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupPayload, response: Response):
    name = " ".join(payload.full_name.strip().split())
    email = str(payload.email).strip().lower()

    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Please enter your name.")

    now = int(time.time())
    try:
        with connect_db() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (full_name, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (name, email, _hash_password(payload.password), now),
            )
            user_id = cursor.lastrowid
            row = conn.execute(
                "SELECT id, full_name, email, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please log in instead.",
        )

    _create_session(user_id, response)
    notifications = _send_signup_notifications(name, email, now)
    return {
        "user": _public_user(row),
        "email_notifications": notifications,
    }


@router.post("/login")
def login(payload: LoginPayload, response: Response):
    email = str(payload.email).strip().lower()
    with connect_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? COLLATE NOCASE",
            (email,),
        ).fetchone()

    if not row or not _verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    _create_session(row["id"], response)
    return {"user": _public_user(row)}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordPayload):
    """Always return the same response to avoid revealing whether an email exists."""
    email = str(payload.email).strip().lower()
    now = int(time.time())
    generic_message = (
        "If an account exists for that email, a password reset link will be sent."
    )

    with connect_db() as conn:
        user = conn.execute(
            "SELECT id, full_name, email FROM users WHERE email = ? COLLATE NOCASE",
            (email,),
        ).fetchone()

        if not user:
            return {"message": generic_message}

        conn.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = ?",
            (user["id"],),
        )
        raw_token = secrets.token_urlsafe(32)
        conn.execute(
            """
            INSERT INTO password_reset_tokens
                (user_id, token_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                user["id"],
                _token_hash(raw_token),
                now + RESET_TOKEN_TTL_SECONDS,
                now,
            ),
        )
        conn.commit()

    frontend_url = os.getenv(
        "FRONTEND_RESET_URL",
        "http://localhost:5173/clinical-app.html",
    ).strip().rstrip("/")
    reset_url = f"{frontend_url}?reset_token={raw_token}"
    safe_url = html.escape(reset_url, quote=True)
    safe_name = html.escape(user["full_name"])

    _send_email(
        recipient=user["email"],
        subject="Reset your Polypharm ADE password",
        title="Password reset",
        text_body=(
            f"Hello {user['full_name']},\n\n"
            "Use this link to set a new password. It expires in 30 minutes "
            "and can be used once:\n\n"
            f"{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        body_html=(
            f"<p>Hello {safe_name},</p>"
            "<p>Use the link below to set a new password. It expires in "
            "30 minutes and can be used once.</p>"
            f'<p><a href="{safe_url}" style="display:inline-block;padding:12px 20px;'
            'border-radius:10px;background:#61dfd0;color:#0d1228;'
            'font-weight:bold;text-decoration:none;">Reset password</a></p>'
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )
    return {"message": generic_message}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordPayload):
    now = int(time.time())
    token_hash = _token_hash(payload.token)

    with connect_db() as conn:
        reset_row = conn.execute(
            """
            SELECT user_id FROM password_reset_tokens
            WHERE token_hash = ? AND expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()

        if not reset_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This reset link is invalid or expired. Request a new one.",
            )

        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (_hash_password(payload.password), reset_row["user_id"]),
        )
        conn.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = ?",
            (reset_row["user_id"],),
        )
        conn.execute(
            "DELETE FROM auth_sessions WHERE user_id = ?",
            (reset_row["user_id"],),
        )
        conn.commit()

    return {"message": "Password changed. Please log in with your new password."}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return {"user": user}


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountPayload,
    response: Response,
    user: dict = Depends(current_user),
):
    with connect_db() as conn:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (user["id"],),
        ).fetchone()

        if not row or not _verify_password(payload.password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="The password is incorrect. Your account was not deleted.",
            )

        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
        conn.commit()

    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    polypharm_session: Optional[str] = Cookie(default=None),
):
    if polypharm_session:
        with connect_db() as conn:
            conn.execute(
                "DELETE FROM auth_sessions WHERE token_hash = ?",
                (_token_hash(polypharm_session),),
            )
            conn.commit()

    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response