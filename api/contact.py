"""Contact form and newsletter subscription functions."""

from typing import Any, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import db_fetch_all, db_fetch_one, db_execute
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ADMIN_EMAIL
from utils import format_timestamp


def _serialize_contact_submission(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Normalize DB row for contact submission responses."""
    if not row:
        return None
    submission = dict(row)
    submission["id"] = str(submission.get("id") or "")
    submission["created_at"] = format_timestamp(submission.get("created_at"))
    submission["updated_at"] = format_timestamp(submission.get("updated_at"))
    return submission


def _serialize_subscription(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Normalize DB row for newsletter subscription responses."""
    if not row:
        return None
    subscription = dict(row)
    subscription["id"] = str(subscription.get("id") or "")
    subscription["subscribed_at"] = format_timestamp(subscription.get("subscribed_at"))
    subscription["unsubscribed_at"] = format_timestamp(subscription.get("unsubscribed_at"))
    return subscription


def submit_contact_form(name: str, email: str, message: str) -> dict[str, Any]:
    """
    Submit a contact form entry to the database.
    
    Args:
        name: The name of the person submitting the form
        email: The email address of the person
        message: The message content
        
    Returns:
        The created contact submission record
    """
    query = """
        INSERT INTO contact_submissions (name, email, message, status, created_at, updated_at)
        VALUES (%s, %s, %s, 'new', NOW(), NOW())
        RETURNING id, name, email, message, status, created_at, updated_at
    """
    
    submission_row = db_fetch_one(query, (name, email, message))
    
    if not submission_row:
        raise RuntimeError("Failed to submit contact form")

    submission = _serialize_contact_submission(submission_row)
    if not submission:
        raise RuntimeError("Failed to serialize contact submission")
    
    # Send email notification to admin
    try:
        send_contact_notification(name, email, message, submission.get("id"))
    except Exception as e:
        # Log error but don't fail the submission
        print(f"Failed to send email notification: {e}")
    
    return submission


def subscribe_newsletter(email: str, name: Optional[str] = None) -> dict[str, Any]:
    """
    Subscribe an email to the newsletter.
    
    Args:
        email: The email address to subscribe
        name: Optional name of the subscriber
        
    Returns:
        The subscription record
    """
    email_lower = email.lower()
    
    # Check if already subscribed
    query = "SELECT * FROM newsletter_subscriptions WHERE email = %s"
    existing_row = db_fetch_one(query, (email_lower,))
    
    if existing_row:
        # If previously unsubscribed, reactivate
        if not existing_row.get("is_active"):
            update_query = """
                UPDATE newsletter_subscriptions 
                SET is_active = true, unsubscribed_at = NULL 
                WHERE id = %s
                RETURNING *
            """
            updated_row = db_fetch_one(update_query, (existing_row["id"],))
            subscription = _serialize_subscription(updated_row)
            if not subscription:
                raise RuntimeError("Failed to serialize subscription")
            return subscription
        subscription = _serialize_subscription(existing_row)
        if not subscription:
            raise RuntimeError("Failed to serialize subscription")
        return subscription
    
    # Create new subscription
    insert_query = """
        INSERT INTO newsletter_subscriptions (email, name, is_active, subscribed_at)
        VALUES (%s, %s, true, NOW())
        RETURNING *
    """
    
    subscription_row = db_fetch_one(insert_query, (email_lower, name))
    
    if not subscription_row:
        raise RuntimeError("Failed to subscribe to newsletter")

    subscription = _serialize_subscription(subscription_row)
    if not subscription:
        raise RuntimeError("Failed to serialize subscription")
    return subscription


def unsubscribe_newsletter(email: str) -> dict[str, Any]:
    """
    Unsubscribe an email from the newsletter.
    
    Args:
        email: The email address to unsubscribe
        
    Returns:
        The updated subscription record
    """
    query = """
        UPDATE newsletter_subscriptions 
        SET is_active = false, unsubscribed_at = NOW()
        WHERE email = %s
        RETURNING *
    """
    
    subscription_row = db_fetch_one(query, (email.lower(),))
    
    if not subscription_row:
        raise RuntimeError("Subscription not found")

    subscription = _serialize_subscription(subscription_row)
    if not subscription:
        raise RuntimeError("Failed to serialize subscription")
    return subscription


def list_contact_submissions(
    status: str | None = None, limit: int = 50, offset: int = 0
) -> list[dict[str, Any]]:
    """
    List contact form submissions with optional filtering.
    
    Args:
        status: Optional status filter (new, read, responded, archived)
        limit: Maximum number of records to return
        offset: Number of records to skip
        
    Returns:
        List of contact submission records
    """
    if status:
        query = """
            SELECT * FROM contact_submissions
            WHERE status = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        rows = db_fetch_all(query, (status, limit, offset))
    else:
        query = """
            SELECT * FROM contact_submissions
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        rows = db_fetch_all(query, (limit, offset))
    
    submissions = [
        submission for submission in (_serialize_contact_submission(row) for row in rows or [])
        if submission
    ]
    return submissions


def update_contact_submission_status(
    submission_id: str, status: str
) -> dict[str, Any]:
    """
    Update the status of a contact submission.
    
    Args:
        submission_id: The ID of the submission to update
        status: The new status (new, read, responded, archived)
        
    Returns:
        The updated submission record
    """
    valid_statuses = ["new", "read", "responded", "archived"]
    if status not in valid_statuses:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    query = """
        UPDATE contact_submissions
        SET status = %s
        WHERE id = %s
        RETURNING *
    """
    
    submission_row = db_fetch_one(query, (status, submission_id))
    
    if not submission_row:
        raise RuntimeError("Submission not found")

    submission = _serialize_contact_submission(submission_row)
    if not submission:
        raise RuntimeError("Failed to serialize contact submission")
    return submission


def delete_contact_submission(submission_id: str) -> bool:
    """
    Delete a contact submission.
    
    Args:
        submission_id: The ID of the submission to delete
        
    Returns:
        True if deleted successfully
        
    Raises:
        RuntimeError: If submission not found
    """
    # First check if submission exists
    check_query = "SELECT id FROM contact_submissions WHERE id = %s"
    existing = db_fetch_one(check_query, (submission_id,))
    
    if not existing:
        raise RuntimeError("Submission not found")
    
    # Delete the submission
    delete_query = "DELETE FROM contact_submissions WHERE id = %s"
    affected_rows = db_execute(delete_query, (submission_id,))
    
    if affected_rows == 0:
        raise RuntimeError("Failed to delete submission")
    
    return True


def send_contact_notification(
    name: str, 
    email: str, 
    message: str, 
    submission_id: str
) -> None:
    """
    Send email notification to admin about new contact form submission.
    
    Args:
        name: Name of the person who submitted the form
        email: Email of the person
        message: The message content
        submission_id: UUID of the submission
    """
    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ADMIN_EMAIL]):
        print("SMTP settings not configured, skipping email notification")
        return
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"New Contact Form Submission from {name}"
    msg["From"] = SMTP_USER
    msg["To"] = ADMIN_EMAIL
    
    text_content = f"""
New contact form submission received:

Name: {name}
Email: {email}
Submission ID: {submission_id}

Message:
{message}

---
This is an automated notification from the Te Waihora Trail website.
"""
    
    html_content = f"""
<html>
<body>
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> {name}</p>
    <p><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
    <p><strong>Submission ID:</strong> {submission_id}</p>
    <h3>Message:</h3>
    <p>{message.replace(chr(10), '<br>')}</p>
    <hr>
    <p><em>This is an automated notification from the Te Waihora Trail website.</em></p>
</body>
</html>
"""
    
    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    
    msg.attach(part1)
    msg.attach(part2)
    
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        raise RuntimeError(f"Failed to send email: {str(e)}")


def list_newsletter_subscribers(
    active_only: bool | None = True, 
    limit: int = 1000
) -> list[dict[str, Any]]:
    """
    List newsletter subscribers.
    
    Args:
        active_only: True = only active, False = only unsubscribed, None = all
        limit: Maximum number of results
        
    Returns:
        List of newsletter subscriptions
    """
    if active_only is True:
        query = """
            SELECT * FROM newsletter_subscriptions
            WHERE is_active = true
            ORDER BY subscribed_at DESC
            LIMIT %s
        """
        rows = db_fetch_all(query, (limit,))
    elif active_only is False:
        query = """
            SELECT * FROM newsletter_subscriptions
            WHERE is_active = false
            ORDER BY subscribed_at DESC
            LIMIT %s
        """
        rows = db_fetch_all(query, (limit,))
    else:
        # active_only is None - return all subscribers
        query = """
            SELECT * FROM newsletter_subscriptions
            ORDER BY subscribed_at DESC
            LIMIT %s
        """
        rows = db_fetch_all(query, (limit,))
    
    subscriptions = [
        subscription for subscription in (_serialize_subscription(row) for row in rows or [])
        if subscription
    ]
    return subscriptions
