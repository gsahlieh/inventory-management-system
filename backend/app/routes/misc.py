# backend/app/routes/misc.py
import logging
from flask import Blueprint, jsonify, request, abort, g
import uuid # Import uuid

# Import decorators, helpers, and supabase client
from ..utils.auth import token_required, roles_required
# from ..utils.helpers import log_audit # Not needed here
from .. import supabase # Import the initialized Supabase client

# Create Blueprint for API-related misc routes
misc_bp = Blueprint("misc", __name__, url_prefix="/api")
# Create a separate Blueprint for the base route without a prefix
base_bp = Blueprint("base", __name__, url_prefix="/")


# == Bonus Features ==
@misc_bp.route("/items/<uuid:item_id>/trends", methods=["GET"])
@token_required
@roles_required("admin", "manager", "viewer")
def get_item_trends(item_id):
    """Get historical quantity data for charting."""
    try:
        # Define actions that signify a quantity change
        quantity_actions = [
            "CREATE_ITEM",
            "UPDATE_QUANTITY",
            "UPDATE_ITEM",
            "BULK_UPDATE_QUANTITY",
        ]

        result = (
            supabase.table("audit_logs")
            .select("timestamp, action, new_values")
            .eq("table_name", "items")
            .eq("record_id", str(item_id))
            .in_("action", quantity_actions)
            .order("timestamp", desc=False) # Get oldest first
            .execute()
        )

        if not result.data:
            # If no audit history, check the item's creation time and current quantity
            current_item = (
                supabase.table("items")
                .select("quantity, created_at") # Assuming you have created_at
                .eq("id", str(item_id))
                .maybe_single()
                .execute()
            )
            if current_item.data and current_item.data.get('created_at'):
                # Return the creation point as the only data point
                return jsonify({
                    "labels": [current_item.data['created_at']],
                    "quantities": [current_item.data['quantity']]
                })
            else:
                # Item not found or has no creation timestamp
                return jsonify({"labels": [], "quantities": []})


        labels = []
        quantities = []

        for log in result.data:
            timestamp = log.get("timestamp")
            new_values = log.get("new_values")
            action = log.get("action")
            quantity = None

            if isinstance(new_values, dict) and timestamp:
                if "quantity" in new_values:
                    # Handles CREATE_ITEM, UPDATE_ITEM, UPDATE_QUANTITY directly
                    quantity = new_values["quantity"]
                elif action == "BULK_UPDATE_QUANTITY" and "updated_items" in new_values:
                    # Find the specific item's update within the bulk log
                    for item_log in new_values.get("updated_items", []):
                        if item_log.get("item_id") == str(item_id):
                            quantity = item_log.get("new_quantity")
                            break

            if quantity is not None:
                # Ensure quantity is integer or float before appending
                try:
                    numeric_quantity = int(quantity) # Or float(quantity) if needed
                    # Avoid duplicate timestamps by updating the last entry if timestamp is the same
                    if labels and labels[-1] == timestamp:
                        quantities[-1] = numeric_quantity
                    else:
                        labels.append(timestamp)
                        quantities.append(numeric_quantity)
                except (ValueError, TypeError):
                     logging.warning(f"Could not parse quantity '{quantity}' for item {item_id} at {timestamp}")


        # Optionally, add the current quantity as the last data point if the last log isn't up-to-date
        # This requires fetching the current item state again.

        return jsonify({"labels": labels, "quantities": quantities})

    except Exception as e:
        logging.error(f"Error fetching trends for item {item_id}: {e}")
        abort(500, description="Failed to retrieve item trends.")


# --- Base Route ---
@base_bp.route("/", methods=["GET"])
def home():
    """A simple route to check if the server is running."""
    # This route doesn't need authentication or specific roles
    return jsonify({"message": "Flask inventory backend is running!"})

