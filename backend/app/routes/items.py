# backend/app/routes/items.py
import io
import logging
import pandas as pd
from flask import Blueprint, jsonify, request, abort, g
import uuid # Import uuid

# Import decorators, helpers, and supabase client
from ..utils.auth import token_required, roles_required
from ..utils.helpers import log_audit, LOW_STOCK_THRESHOLD
from .. import supabase # Import the initialized Supabase client

# Create Blueprint
# All routes in this file will be prefixed with /api/items
items_bp = Blueprint("items", __name__, url_prefix="/api/items")


# == Inventory Items ==
@items_bp.route("", methods=["POST"]) # Route is now relative to blueprint prefix
@token_required
@roles_required("admin")
def add_item():
    """Admin: Add a new item to inventory."""
    data = request.get_json()
    if not data or not all(k in data for k in ("name", "quantity", "price")):
        abort(400, description="Missing required fields: name, quantity, price")

    try:
        new_item = {
            "name": data["name"],
            "quantity": int(data["quantity"]),
            "price": float(data["price"]),
            "category": data.get("category"), # Optional
        }
        if new_item["quantity"] < 0 or new_item["price"] < 0:
            abort(400, description="Quantity and price cannot be negative.")

        result = supabase.table("items").insert(new_item).execute()

        if not hasattr(result, "data") or not result.data:
            logging.error(
                f"Failed to insert item, unexpected response: {result}"
            )
            abort(500, description="Failed to save item to database.")

        created_item = result.data[0]
        log_audit(
            action="CREATE_ITEM",
            table_name="items",
            record_id=created_item["id"],
            new_values=created_item,
        )
        return jsonify(created_item), 201

    except (ValueError, TypeError) as e:
        abort(400, description=f"Invalid data format: {e}")
    except Exception as e:
        logging.exception(f"Error adding item: {e}")
        abort(500, description="Failed to add item due to server error.")


@items_bp.route("", methods=["GET"])
@token_required
@roles_required("admin", "manager", "viewer")
def get_items():
    """Admin/Manager/Viewer: List all inventory items."""
    try:
        query = supabase.table("items").select("*").order("name")
        result = query.execute()
        return jsonify(result.data)
    except Exception as e:
        logging.exception(f"Error fetching items: {e}")
        abort(500, description="Failed to retrieve items.")


@items_bp.route("/<uuid:item_id>", methods=["GET"])
@token_required
@roles_required("admin", "manager", "viewer")
def get_item(item_id):
    """Admin/Manager/Viewer: Get details of a specific item."""
    try:
        result = (
            supabase.table("items")
            .select("*")
            .eq("id", str(item_id))
            .maybe_single()
            .execute()
        )
        if not result.data:
            abort(404, description="Item not found.")
        return jsonify(result.data)
    except Exception as e:
        logging.error(f"Error fetching item {item_id}: {e}")
        abort(500, description="Failed to retrieve item details.")


@items_bp.route("/<uuid:item_id>", methods=["PUT"])
@token_required
@roles_required("admin", "manager") # Changed from admin only in original? Keeping admin/manager
def update_item(item_id):
    """Admin/Manager: Update all details of a specific item."""
    data = request.get_json()
    if not data:
        abort(400, description="Request body cannot be empty for PUT.")

    update_data = {}
    allowed_fields = ["name", "quantity", "price", "category"]
    for field in allowed_fields:
        if field in data:
            if field == "quantity":
                try:
                    val = int(data[field])
                    if val < 0:
                        raise ValueError("Quantity cannot be negative.")
                    update_data[field] = val
                except (ValueError, TypeError):
                    abort(400, description=f"Invalid format for quantity.")
            elif field == "price":
                try:
                    val = float(data[field])
                    if val < 0:
                        raise ValueError("Price cannot be negative.")
                    update_data[field] = val
                except (ValueError, TypeError):
                    abort(400, description=f"Invalid format for price.")
            else:
                update_data[field] = data[field] # name, category (string)

    if not update_data:
        abort(400, description="No valid fields provided for update.")

    try:
        old_result = (
            supabase.table("items")
            .select("*")
            .eq("id", str(item_id))
            .maybe_single()
            .execute()
        )
        if not old_result.data:
            abort(404, description="Item not found.")
        old_values = old_result.data

        result = (
            supabase.table("items")
            .update(update_data)
            .eq("id", str(item_id))
            .execute()
        )

        if not result.data:
            raise Exception("Failed to update item, no data returned.")

        updated_item = result.data[0]
        log_audit(
            action="UPDATE_ITEM",
            table_name="items",
            record_id=item_id,
            old_values=old_values,
            new_values=updated_item,
        )
        return jsonify(updated_item)

    except Exception as e:
        logging.error(f"Error updating item {item_id}: {e}")
        abort(500, description="Failed to update item.")


@items_bp.route("/<uuid:item_id>/quantity", methods=["PATCH"])
@token_required
@roles_required("admin", "manager")
def update_item_quantity(item_id):
    """Admin/Manager: Update only the quantity of an item."""
    data = request.get_json()
    if not data or "quantity" not in data:
        abort(400, description="Missing 'quantity' field in request body.")

    try:
        new_quantity = int(data["quantity"])
        if new_quantity < 0:
            abort(400, description="Quantity cannot be negative.")

        old_result = (
            supabase.table("items")
            .select("quantity")
            .eq("id", str(item_id))
            .maybe_single()
            .execute()
        )
        if not old_result.data:
            abort(404, description="Item not found.")
        old_quantity = old_result.data["quantity"]

        result = (
            supabase.table("items")
            .update({"quantity": new_quantity})
            .eq("id", str(item_id))
            .execute()
        )

        if not result.data:
            raise Exception("Failed to update quantity, no data returned.")

        updated_item = result.data[0]
        log_audit(
            action="UPDATE_QUANTITY",
            table_name="items",
            record_id=item_id,
            old_values={"quantity": old_quantity},
            new_values={"quantity": new_quantity},
        )
        # Check for low stock after update
        if (
            new_quantity < LOW_STOCK_THRESHOLD
            and old_quantity >= LOW_STOCK_THRESHOLD
        ):
            log_audit(
                action="LOW_STOCK_TRIGGERED",
                table_name="items",
                record_id=item_id,
                new_values={
                    "quantity": new_quantity,
                    "threshold": LOW_STOCK_THRESHOLD,
                },
            )
            # TODO: Implement actual notification sending here

        return jsonify(updated_item)

    except (ValueError, TypeError):
        abort(400, description="Invalid quantity format. Must be an integer.")
    except Exception as e:
        logging.error(f"Error updating quantity for item {item_id}: {e}")
        abort(500, description="Failed to update item quantity.")


@items_bp.route("/<uuid:item_id>", methods=["DELETE"])
@token_required
@roles_required("admin")
def delete_item(item_id):
    """Admin: Delete an inventory item."""
    try:
        old_result = (
            supabase.table("items")
            .select("*")
            .eq("id", str(item_id))
            .maybe_single()
            .execute()
        )
        if not old_result.data:
            abort(404, description="Item not found.")
        old_values = old_result.data

        supabase.table("items").delete().eq("id", str(item_id)).execute()
        # Note: delete() doesn't always return data, check Supabase docs/behavior

        log_audit(
            action="DELETE_ITEM",
            table_name="items",
            record_id=item_id,
            old_values=old_values,
        )
        # 204 No Content is often preferred for successful DELETE
        return jsonify({"message": "Item deleted successfully"}), 200

    except Exception as e:
        logging.error(f"Error deleting item {item_id}: {e}")
        abort(500, description="Failed to delete item.")


@items_bp.route("/bulk-update-quantity", methods=["POST"])
@token_required
@roles_required("manager") # Original had admin/manager, keeping manager
def bulk_update_quantity():
    """Manager: Bulk update quantities via CSV upload."""
    if "file" not in request.files:
        abort(400, description="No file part in the request.")
    file = request.files["file"]
    if file.filename == "":
        abort(400, description="No selected file.")
    if not file or not file.filename.lower().endswith(".csv"):
        abort(400, description="Invalid file type. Please upload a CSV file.")

    results = {"success": 0, "failed": 0, "errors": []}
    updated_items_log = []

    try:
        csv_data = io.BytesIO(file.read())
        df = pd.read_csv(csv_data)

        if "item_id" not in df.columns or "new_quantity" not in df.columns:
            abort(
                400,
                description="CSV must contain 'item_id' and 'new_quantity' columns.",
            )

        for index, row in df.iterrows():
            item_id_str = str(row["item_id"]).strip()
            new_quantity_val = row["new_quantity"]

            try:
                if not item_id_str:
                    raise ValueError("Item ID cannot be empty")
                # Add UUID validation if needed: uuid.UUID(item_id_str)

                new_quantity = int(new_quantity_val)
                if new_quantity < 0:
                    raise ValueError("Quantity cannot be negative.")

                old_res = (
                    supabase.table("items")
                    .select("quantity")
                    .eq("id", item_id_str)
                    .maybe_single()
                    .execute()
                )
                if not old_res.data:
                    raise ValueError(f"Item ID '{item_id_str}' not found.")
                old_quantity = old_res.data["quantity"]

                upd_res = (
                    supabase.table("items")
                    .update({"quantity": new_quantity})
                    .eq("id", item_id_str)
                    .execute()
                )
                if not upd_res.data:
                    raise Exception("Update failed, no data returned from DB.")

                results["success"] += 1
                updated_items_log.append(
                    {
                        "item_id": item_id_str,
                        "old_quantity": old_quantity,
                        "new_quantity": new_quantity,
                    }
                )
                if (
                    new_quantity < LOW_STOCK_THRESHOLD
                    and old_quantity >= LOW_STOCK_THRESHOLD
                ):
                    log_audit(
                        action="LOW_STOCK_TRIGGERED",
                        table_name="items",
                        record_id=item_id_str,
                        new_values={
                            "quantity": new_quantity,
                            "threshold": LOW_STOCK_THRESHOLD,
                        },
                    )
                    # TODO: Implement notification sending

            except (ValueError, TypeError) as ve:
                results["failed"] += 1
                results["errors"].append(
                    f"Row {index + 2}: Invalid data - {ve} (ID: {item_id_str}, Qty: {new_quantity_val})"
                )
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(
                    f"Row {index + 2}: Failed to update item {item_id_str} - {e}"
                )

        log_audit(
            action="BULK_UPDATE_QUANTITY",
            table_name="items",
            new_values={"summary": results, "updated_items": updated_items_log},
        )
        return jsonify(results)

    except pd.errors.EmptyDataError:
        abort(400, description="CSV file is empty.")
    except pd.errors.ParserError:
        abort(400, description="Error parsing CSV file. Please check format.")
    except Exception as e:
        logging.error(f"Error during bulk update: {e}")
        log_audit(
            action="BULK_UPDATE_QUANTITY_FAILED", new_values={"error": str(e)}
        )
        abort(500, description=f"An error occurred during bulk update: {e}")
