# backend/app/routes/reports.py
import logging
from datetime import datetime
from flask import Blueprint, jsonify, request, abort, g

# Import decorators, helpers, and supabase client
from ..utils.auth import token_required, roles_required
from ..utils.helpers import log_audit, LOW_STOCK_THRESHOLD
from .. import supabase # Import the initialized Supabase client

# Create Blueprint - Use a general /api prefix as routes are distinct
reports_bp = Blueprint("reports", __name__, url_prefix="/api")


# == Reports and Alerts ==
@reports_bp.route("/alerts/low-stock", methods=["GET"])
@token_required
@roles_required("admin", "manager")
def get_low_stock_alerts():
    """Admin/Manager: Get items below the low stock threshold."""
    try:
        threshold = request.args.get(
            "threshold", default=LOW_STOCK_THRESHOLD, type=int
        )
        result = (
            supabase.table("items")
            .select("id, name, quantity, category")
            .lt("quantity", threshold)
            .order("quantity")
            .execute()
        )
        return jsonify(result.data)
    except Exception as e:
        logging.error(f"Error fetching low stock items: {e}")
        abort(500, description="Failed to retrieve low stock alerts.")


@reports_bp.route("/reports/inventory/monthly", methods=["GET"])
@token_required
@roles_required("admin")
def get_monthly_inventory_report():
    """Admin: Generate a monthly inventory report (basic: current snapshot)."""
    try:
        # Note: year/month args aren't used in the current logic which fetches live data
        # Keep them if you plan to implement historical reporting later
        year = request.args.get("year", default=datetime.utcnow().year, type=int)
        month = request.args.get(
            "month", default=datetime.utcnow().month, type=int
        )

        items_result = (
            supabase.table("items")
            .select("id, name, quantity, price, category")
            .order("name")
            .execute()
        )

        total_value = sum(
            item["quantity"] * float(item.get("price", 0)) # Handle potential missing price
            for item in items_result.data
        )
        total_items = sum(item["quantity"] for item in items_result.data)
        distinct_item_count = len(items_result.data)

        report_data = {
            "report_month": f"{year}-{month:02d}",
            "generated_at": datetime.utcnow().isoformat(),
            "total_distinct_items": distinct_item_count,
            "total_units": total_items,
            "total_inventory_value": round(total_value, 2),
            "inventory_snapshot": items_result.data,
        }

        log_audit(
            action="GENERATE_MONTHLY_REPORT",
            new_values={"month": f"{year}-{month:02d}"},
        )
        return jsonify(report_data)

    except Exception as e:
        logging.error(f"Error generating monthly report: {e}")
        abort(500, description="Failed to generate monthly inventory report.")

