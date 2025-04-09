# backend/app/routes/audit.py
import logging
from flask import Blueprint, jsonify, request, abort, g

# Import decorators, helpers, and supabase client
from ..utils.auth import token_required, roles_required
# from ..utils.helpers import log_audit # Not needed here unless logging access
from .. import supabase # Import the initialized Supabase client

# Create Blueprint
audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit-logs")


# == Audit Logs ==
@audit_bp.route("", methods=["GET"])
@token_required
@roles_required("admin")
def get_audit_logs():
    """Admin: View audit log entries with filtering."""
    try:
        page = request.args.get("page", default=1, type=int)
        limit = request.args.get("limit", default=20, type=int)
        offset = (page - 1) * limit

        # Start query with count
        query = supabase.table("audit_logs").select("*", count="exact")

        # Filtering
        user_filter = request.args.get("user_id")
        action_filter = request.args.get("action")
        start_date = request.args.get("start_date") # e.g., 2023-10-27T00:00:00Z
        end_date = request.args.get("end_date")     # e.g., 2023-10-28T00:00:00Z
        table_filter = request.args.get("table_name")
        record_filter = request.args.get("record_id")

        if user_filter:
            query = query.eq("user_id", user_filter)
        if action_filter:
            query = query.eq("action", action_filter)
        if start_date:
            query = query.gte("timestamp", start_date)
        if end_date:
            query = query.lte("timestamp", end_date)
        if table_filter:
            query = query.eq("table_name", table_filter)
        if record_filter:
            query = query.eq("record_id", record_filter)


        # Apply ordering and pagination *after* filtering
        query = query.order("timestamp", desc=True).range(offset, offset + limit - 1)

        result = query.execute()

        # Check for errors in response if necessary (depends on client library)
        # if hasattr(result, 'error') and result.error:
        #     raise Exception(f"Error fetching audit logs: {result.error}")

        return jsonify({"data": result.data, "count": result.count})
    except Exception as e:
        logging.error(f"Error fetching audit logs: {e}")
        abort(500, description="Failed to retrieve audit logs.")

