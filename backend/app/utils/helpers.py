# backend/app/utils/helpers.py
import logging
from datetime import datetime
from flask import request, g

# Import the globally initialized supabase client from the app package
from .. import supabase

# --- Constants ---
LOW_STOCK_THRESHOLD = 10


# --- Helper Functions ---
def log_audit(
    action,
    table_name=None,
    record_id=None,
    old_values=None,
    new_values=None,
    success=True, # Keep success flag if needed, though not used in original
):
    """Logs an action to the audit_logs table."""
    user_id = getattr(g, "user_id", None)
    if not user_id:
        # Logged-in actions should always have a user_id after token_required
        logging.warning(
            f"Audit log attempt without user_id for action: {action}"
        )
        # Decide whether to log with None user_id or skip
        # return # Uncomment to skip logging if user_id is missing

    log_entry = {
        "user_id": user_id,
        "action": action,
        "table_name": table_name,
        "record_id": str(record_id) if record_id else None,
        "old_values": old_values if old_values else None,
        "new_values": new_values if new_values else None,
        "timestamp": datetime.utcnow().isoformat(),
        "ip_address": request.remote_addr,
        # Add success field if your audit_logs table has it
        # "success": success
    }
    try:
        # Use the imported service role client to insert logs
        supabase.table("audit_logs").insert(log_entry).execute()
        logging.debug(f"Audit log created: {action} by {user_id or 'System'}")
    except Exception as e:
        logging.error(
            f"Failed to insert audit log: {e} - Entry: {log_entry}"
        )

