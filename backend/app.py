# app.py
import os
import io
import json # Keep for request/response bodies
import logging
from functools import wraps
from datetime import datetime # Keep for timestamps

# Remove unused imports related to manual JWT validation
# import jwt
# import requests
# from jwt.exceptions import (...)

import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, request, g, abort
from flask_cors import CORS
from supabase import create_client, Client
# Import the specific exception for auth errors from gotrue-py (used by supabase-py)
# from gotrue import AuthApiError


# --- Basic Logging Setup ---
logging.basicConfig(level=logging.DEBUG) # Keep DEBUG for detailed logs

# --- Load Environment Variables ---
load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Service role key is still needed for backend operations
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# --- Environment Variable Validation ---
missing_vars = []
if not SUPABASE_URL: missing_vars.append("SUPABASE_URL")
if not SUPABASE_KEY: missing_vars.append("SUPABASE_SERVICE_ROLE_KEY")
# SUPABASE_AUTH_URL is no longer strictly needed for validation itself
if missing_vars:
    raise ValueError(f"Missing environment variables: {', '.join(missing_vars)}")

logging.info(f"Supabase URL: {SUPABASE_URL}")
logging.info(f"Frontend URL: {FRONTEND_URL}")


# --- Supabase Client Initialization ---
# The main client uses the Service Role Key for database operations
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logging.info("Supabase client initialized successfully (using Service Role Key).")
except Exception as e:
    logging.error(f"Failed to initialize Supabase client: {e}")
    raise

# --- Flask App Initialization ---
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": FRONTEND_URL}})

# --- Constants ---
LOW_STOCK_THRESHOLD = 10

# --- Helper Functions ---

def log_audit(action, table_name=None, record_id=None, old_values=None, new_values=None, success=True):
    """Logs an action to the audit_logs table."""
    user_id = getattr(g, 'user_id', None)
    if not user_id:
        # Logged-in actions should always have a user_id after token_required
        logging.warning(f"Audit log attempt without user_id for action: {action}")
        # Consider if you want to prevent logging or log with None user_id
        # return

    log_entry = {
        "user_id": user_id,
        "action": action,
        "table_name": table_name,
        "record_id": str(record_id) if record_id else None,
        "old_values": old_values if old_values else None,
        "new_values": new_values if new_values else None,
        "timestamp": datetime.utcnow().isoformat(),
        "ip_address": request.remote_addr,
    }
    try:
        # Use the service role client to insert logs
        supabase.table("audit_logs").insert(log_entry).execute()
        logging.debug(f"Audit log created: {action} by {user_id}")
    except Exception as e:
        logging.error(f"Failed to insert audit log: {e} - Entry: {log_entry}")


# --- Authentication & Authorization Decorators ---

def token_required(f):
    """Decorator to validate JWT token using supabase.auth.get_user()."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
                logging.debug(f"Received token: {token[:5]}...{token[-5:]}")
            else:
                logging.warning(f"Invalid Authorization header format: {auth_header}")
                return jsonify({"message": "Invalid Authorization header format"}), 401
        else:
             logging.warning("Authorization header is missing.")
             return jsonify({"message": "Authorization header is missing"}), 401

        if not token:
            # Should be caught above, but double-check
            logging.warning("Authorization token is missing.")
            return jsonify({"message": "Token is missing"}), 401

        try:
            # Use supabase.auth.get_user() with the extracted token
            # This validates the token against the Supabase backend
            logging.debug("Attempting to validate token with supabase.auth.get_user...")

            # The main `supabase` client instance uses the service key.
            # `supabase.auth.get_user(jwt=token)` uses the provided token
            # to make a request to the GoTrue endpoint for validation.
            user_response = supabase.auth.get_user(jwt=token)

            if user_response and user_response.user:
                # Store validated user info in Flask's global context 'g'
                g.user = user_response.user # Store the whole user object if needed
                g.user_id = user_response.user.id
                g.user_email = user_response.user.email # Email might be None depending on user setup
                logging.info(f"Token validated successfully via Supabase for user: {g.user_id} ({g.user_email or 'No email'})")
            else:
                 # This case indicates an unexpected issue with the library or response
                 logging.error(f"supabase.auth.get_user succeeded but returned invalid data: {user_response}")
                 # Treat as an internal server error because validation should either succeed or raise AuthApiError
                 abort(500, description="Authentication check failed unexpectedly.")

        except Exception as e:
            # AuthApiError is raised by gotrue-py for invalid tokens, expired tokens, etc.
            logging.warning(f"Token validation failed via Supabase: {e.message} (Status: {e.status})")
            # Provide a slightly more specific message based on common errors
            if "invalid JWT" in e.message.lower():
                 msg = "Invalid token provided."
            elif "JWT expired" in e.message.lower():
                 msg = "Token has expired."
            else:
                 msg = "Authentication failed." # Generic message for other auth errors
            return jsonify({"message": msg}), 401 # Return 401 Unauthorized
        except Exception as e:
            # Catch any other unexpected errors (network issues talking to Supabase Auth, etc.)
            logging.exception(f"An unexpected error occurred during Supabase token validation: {e}")
            abort(500, description="An unexpected error occurred during authentication.")

        # If validation succeeded, proceed to the decorated function
        return f(*args, **kwargs)
    return decorated_function


def roles_required(*required_roles):
    """Decorator factory to check user roles (using g.user_id set by token_required)."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Ensure token_required ran successfully and set g.user_id
            if not hasattr(g, 'user_id') or not g.user_id:
                logging.error("roles_required used without preceding successful token_required.")
                abort(500, description="Server configuration error: User context not available after authentication.")

            user_id = g.user_id
            logging.debug(f"Checking roles for user: {user_id}. Required: {required_roles}")
            try:
                # Fetch the user's role from our custom user_roles table
                # Use the main `supabase` client (with service key) for this database query
                result = supabase.table("user_roles").select("role").eq("user_id", user_id).maybe_single().execute()

                if not result.data:
                    logging.warning(f"No role found in 'user_roles' table for user_id: {user_id}")
                    # You might want to double-check if the user exists in auth.users here
                    # as a sanity check, but the token was already validated.
                    # This implies the user exists in auth but wasn't added to user_roles (e.g., trigger failed).
                    abort(403, description="User role not assigned. Please contact an administrator.")

                user_role = result.data.get("role")
                g.user_role = user_role # Store role in context as well

                if user_role not in required_roles:
                    logging.warning(f"Authorization failed: User {user_id} with role '{user_role}' attempted action requiring roles: {required_roles}")
                    abort(403, description=f"Access forbidden: Requires role(s) {', '.join(required_roles)}")

                logging.debug(f"User {user_id} authorized with role: {user_role}")

            except Exception as e:
                # Catch database errors or other issues during role fetching
                logging.exception(f"Error fetching role for user {user_id}: {e}")
                abort(500, description="Error checking user permissions.")

            # If role check passed, proceed to the decorated function
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# --- Error Handlers (remain the same) ---
@app.errorhandler(400)
def bad_request(e):
    logging.warning(f"Bad Request: {e.description}")
    return jsonify(error=str(e.description)), 400

@app.errorhandler(401)
def unauthorized(e):
    logging.warning(f"Unauthorized: {e.description}")
    return jsonify(error=str(e.description)), 401

@app.errorhandler(403)
def forbidden(e):
    logging.warning(f"Forbidden: {e.description}")
    return jsonify(error=str(e.description)), 403

@app.errorhandler(404)
def not_found(e):
    logging.warning(f"Not Found: {e.description}")
    return jsonify(error=str(e.description)), 404

@app.errorhandler(500)
def internal_server_error(e):
    # Use original exception if available, otherwise the generic description
    error_details = getattr(e, 'original_exception', str(e))
    # Check if it's an HTTPException with a description
    description = getattr(e, 'description', str(error_details))
    logging.exception(f"Internal Server Error: {description}") # Log traceback
    # Return the description from abort() if available, otherwise generic message
    return jsonify(error=description or "An internal server error occurred."), 500


# --- API Routes ---

# == Inventory Items ==
@app.route('/api/items', methods=['POST'])
@token_required # Uses the new validation method
# @roles_required('admin')
def add_item():
    """Admin: Add a new item to inventory."""
    data = request.get_json()
    if not data or not all(k in data for k in ('name', 'quantity', 'price')):
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

        # Use the service role client for database insertion
        result = supabase.table("items").insert(new_item).execute()

        if not hasattr(result, 'data') or not result.data:
             logging.error(f"Failed to insert item, unexpected response: {result}")
             abort(500, description="Failed to save item to database.")

        created_item = result.data[0]
        # Log audit uses g.user_id set by token_required
        log_audit(action="CREATE_ITEM", table_name="items", record_id=created_item['id'], new_values=created_item)
        return jsonify(created_item), 201

    except (ValueError, TypeError) as e:
        abort(400, description=f"Invalid data format: {e}")
    except Exception as e:
        logging.exception(f"Error adding item: {e}")
        abort(500, description="Failed to add item due to server error.")

@app.route('/api/items', methods=['GET'])
@token_required
# @roles_required('admin', 'manager', 'viewer')
def get_items():
    """Admin/Manager/Viewer: List all inventory items."""
    try:
        query = supabase.table("items").select("*").order("name")
        result = query.execute()
        return jsonify(result.data)
    except Exception as e:
        logging.exception(f"Error fetching items: {e}")
        abort(500, description="Failed to retrieve items.")


@app.route('/api/items/<uuid:item_id>', methods=['GET'])
@token_required
# @roles_required('admin', 'manager', 'viewer')
def get_item(item_id):
    """Admin/Manager/Viewer: Get details of a specific item."""
    try:
        result = supabase.table("items").select("*").eq("id", str(item_id)).maybe_single().execute()
        if not result.data:
            abort(404, description="Item not found.")
        return jsonify(result.data)
    except Exception as e:
        logging.error(f"Error fetching item {item_id}: {e}")
        abort(500, description="Failed to retrieve item details.")


@app.route('/api/items/<uuid:item_id>', methods=['PUT'])
@token_required
# @roles_required('admin')
def update_item(item_id):
    """Admin: Update all details of a specific item."""
    data = request.get_json()
    if not data:
        abort(400, description="Request body cannot be empty for PUT.")

    update_data = {}
    allowed_fields = ['name', 'quantity', 'price', 'category']
    for field in allowed_fields:
        if field in data:
            # Basic validation
            if field == 'quantity':
                try:
                    val = int(data[field])
                    if val < 0: raise ValueError("Quantity cannot be negative.")
                    update_data[field] = val
                except (ValueError, TypeError):
                    abort(400, description=f"Invalid format for quantity.")
            elif field == 'price':
                 try:
                    val = float(data[field])
                    if val < 0: raise ValueError("Price cannot be negative.")
                    update_data[field] = val
                 except (ValueError, TypeError):
                    abort(400, description=f"Invalid format for price.")
            else:
                 update_data[field] = data[field] # name, category (string)

    if not update_data:
         abort(400, description="No valid fields provided for update.")

    try:
        # Fetch old values for audit log
        old_result = supabase.table("items").select("*").eq("id", str(item_id)).maybe_single().execute()
        if not old_result.data:
            abort(404, description="Item not found.")
        old_values = old_result.data

        # Perform update
        result = supabase.table("items").update(update_data).eq("id", str(item_id)).execute()

        if not result.data:
             raise Exception("Failed to update item, no data returned.")

        updated_item = result.data[0]
        log_audit(action="UPDATE_ITEM", table_name="items", record_id=item_id, old_values=old_values, new_values=updated_item)
        return jsonify(updated_item)

    except Exception as e:
        logging.error(f"Error updating item {item_id}: {e}")
        abort(500, description="Failed to update item.")


@app.route('/api/items/<uuid:item_id>/quantity', methods=['PATCH'])
@token_required
# @roles_required('admin', 'manager')
def update_item_quantity(item_id):
    """Admin/Manager: Update only the quantity of an item."""
    data = request.get_json()
    if not data or 'quantity' not in data:
        abort(400, description="Missing 'quantity' field in request body.")

    try:
        new_quantity = int(data['quantity'])
        if new_quantity < 0:
            abort(400, description="Quantity cannot be negative.")

        # Fetch old quantity for audit log
        old_result = supabase.table("items").select("quantity").eq("id", str(item_id)).maybe_single().execute()
        if not old_result.data:
            abort(404, description="Item not found.")
        old_quantity = old_result.data['quantity']

        # Perform update
        result = supabase.table("items").update({"quantity": new_quantity}).eq("id", str(item_id)).execute()

        if not result.data:
             raise Exception("Failed to update quantity, no data returned.")

        updated_item = result.data[0] # The result usually contains the updated row
        log_audit(
            action="UPDATE_QUANTITY",
            table_name="items",
            record_id=item_id,
            old_values={"quantity": old_quantity},
            new_values={"quantity": new_quantity}
        )
        # Check for low stock after update
        if new_quantity < LOW_STOCK_THRESHOLD and old_quantity >= LOW_STOCK_THRESHOLD:
             log_audit(action="LOW_STOCK_TRIGGERED", table_name="items", record_id=item_id, new_values={"quantity": new_quantity, "threshold": LOW_STOCK_THRESHOLD})
             # TODO: Implement actual notification sending here (email/push) - see Bonus section

        return jsonify(updated_item) # Return the updated item data

    except (ValueError, TypeError):
        abort(400, description="Invalid quantity format. Must be an integer.")
    except Exception as e:
        logging.error(f"Error updating quantity for item {item_id}: {e}")
        abort(500, description="Failed to update item quantity.")


@app.route('/api/items/<uuid:item_id>', methods=['DELETE'])
@token_required
# @roles_required('admin')
def delete_item(item_id):
    """Admin: Delete an inventory item."""
    try:
        # Fetch old values for audit log before deleting
        old_result = supabase.table("items").select("*").eq("id", str(item_id)).maybe_single().execute()
        if not old_result.data:
            abort(404, description="Item not found.")
        old_values = old_result.data

        # Perform delete
        result = supabase.table("items").delete().eq("id", str(item_id)).execute()

        # Check if deletion was successful (Supabase delete might not return data on success)
        # A more robust check might involve verifying the item is gone, but checking the response status/count is typical
        # Assuming success if no exception is raised and maybe checking response metadata if available

        log_audit(action="DELETE_ITEM", table_name="items", record_id=item_id, old_values=old_values)
        return jsonify({"message": "Item deleted successfully"}), 200 # Or 204 No Content

    except Exception as e:
        logging.error(f"Error deleting item {item_id}: {e}")
        abort(500, description="Failed to delete item.")


@app.route('/api/items/bulk-update-quantity', methods=['POST'])
@token_required
# @roles_required('admin', 'manager')
def bulk_update_quantity():
    """Admin/Manager: Bulk update quantities via CSV upload."""
    if 'file' not in request.files:
        abort(400, description="No file part in the request.")
    file = request.files['file']
    if file.filename == '':
        abort(400, description="No selected file.")
    if not file or not file.filename.lower().endswith('.csv'):
         abort(400, description="Invalid file type. Please upload a CSV file.")

    results = {"success": 0, "failed": 0, "errors": []}
    updated_items_log = [] # For single audit log entry

    try:
        # Use BytesIO to read the file stream directly into pandas
        csv_data = io.BytesIO(file.read())
        df = pd.read_csv(csv_data)

        # Expect columns like 'item_id' (or 'name'/'sku') and 'new_quantity'
        if 'item_id' not in df.columns or 'new_quantity' not in df.columns:
            abort(400, description="CSV must contain 'item_id' and 'new_quantity' columns.")

        for index, row in df.iterrows():
            item_id_str = str(row['item_id']).strip()
            new_quantity_val = row['new_quantity']

            try:
                # Validate item_id format (basic check)
                if not item_id_str: # Handle empty strings
                     raise ValueError("Item ID cannot be empty")
                # You might add UUID validation here if using UUIDs

                # Validate quantity
                new_quantity = int(new_quantity_val)
                if new_quantity < 0:
                    raise ValueError("Quantity cannot be negative.")

                # Fetch old quantity
                old_res = supabase.table("items").select("quantity").eq("id", item_id_str).maybe_single().execute()
                if not old_res.data:
                    raise ValueError(f"Item ID '{item_id_str}' not found.")
                old_quantity = old_res.data['quantity']

                # Update quantity
                upd_res = supabase.table("items").update({"quantity": new_quantity}).eq("id", item_id_str).execute()
                if not upd_res.data:
                     raise Exception("Update failed, no data returned from DB.")

                results["success"] += 1
                updated_items_log.append({
                    "item_id": item_id_str,
                    "old_quantity": old_quantity,
                    "new_quantity": new_quantity
                })
                # Check for low stock trigger during bulk update as well
                if new_quantity < LOW_STOCK_THRESHOLD and old_quantity >= LOW_STOCK_THRESHOLD:
                    log_audit(action="LOW_STOCK_TRIGGERED", table_name="items", record_id=item_id_str, new_values={"quantity": new_quantity, "threshold": LOW_STOCK_THRESHOLD})
                    # TODO: Implement notification sending

            except (ValueError, TypeError) as ve:
                results["failed"] += 1
                results["errors"].append(f"Row {index + 2}: Invalid data - {ve} (ID: {item_id_str}, Qty: {new_quantity_val})")
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"Row {index + 2}: Failed to update item {item_id_str} - {e}")

        # Log the entire bulk operation
        log_audit(
            action="BULK_UPDATE_QUANTITY",
            table_name="items",
            new_values={"summary": results, "updated_items": updated_items_log}
        )
        return jsonify(results)

    except pd.errors.EmptyDataError:
         abort(400, description="CSV file is empty.")
    except pd.errors.ParserError:
         abort(400, description="Error parsing CSV file. Please check format.")
    except Exception as e:
        logging.error(f"Error during bulk update: {e}")
        log_audit(action="BULK_UPDATE_QUANTITY_FAILED", new_values={"error": str(e)})
        abort(500, description=f"An error occurred during bulk update: {e}")


# == User Role Management ==
@app.route('/api/users', methods=['GET'])
@token_required
# @roles_required('admin')
def get_users():
    """Admin: List users and their roles."""
    logging.debug("Attempting to fetch users and roles...")
    try:
        # 1. Fetch roles from user_roles table
        logging.debug("Fetching data from user_roles...")
        roles_result = supabase.table("user_roles").select("user_id, role").execute()

        if not hasattr(roles_result, 'data'):
             logging.error(f"Unexpected response structure from user_roles query: {roles_result}")
             abort(500, description="Failed to retrieve roles (unexpected response).")

        logging.debug(f"Fetched {len(roles_result.data)} roles from user_roles.")
        if not roles_result.data:
            logging.info("No users found in user_roles table.")
            return jsonify([])

        # 2. Prepare list of user IDs safely
        user_ids = []
        try:
            for u in roles_result.data:
                user_id = u.get('user_id')
                if user_id:
                    user_ids.append(str(user_id))
                else:
                    logging.warning(f"Found entry in user_roles without user_id: {u}")
            if not user_ids:
                 logging.warning("No valid user_ids found in user_roles data.")
                 return jsonify([])
            logging.debug(f"User IDs to fetch from auth.users: {user_ids}")
        except Exception as e:
             logging.exception(f"Unexpected error processing user IDs from roles: {e}")
             abort(500, description="Internal error processing role data.")

        # 3. Fetch corresponding emails from auth.users
        # --- CORRECTED APPROACH for querying auth.users ---
        logging.debug(f"Fetching emails for {len(user_ids)} users from auth.users...")
        try:
            # Use the admin interface for auth operations when using service key
            # This is generally safer and more intended for backend auth schema access.
            # Note: list_users() might have pagination, handle if necessary for large user bases.
            # We filter *after* fetching, which isn't ideal for performance but works for moderate numbers.
            # A more performant way might involve a custom DB function/view if needed.

            list_users_response = supabase.auth.admin.list_users()

            # Check if the response is a list (newer versions) or an object with a 'users' attribute (older versions)
            auth_users_list = []
            if isinstance(list_users_response, list):
                 auth_users_list = list_users_response
            elif hasattr(list_users_response, 'users'):
                 auth_users_list = list_users_response.users
            else:
                 logging.error(f"Unexpected response type from list_users: {type(list_users_response)}")
                 abort(500, description="Failed to parse user list from authentication system.")

            # Filter the fetched users based on the user_ids we have roles for
            filtered_users_data = [
                {"id": str(user.id), "email": user.email}
                for user in auth_users_list if str(user.id) in user_ids
            ]
            logging.debug(f"Filtered {len(filtered_users_data)} users from auth list.")

        except Exception as e:
             # Catch potential errors during the admin API call
             logging.exception(f"Error calling supabase.auth.admin.list_users(): {e}")
             abort(500, description="Failed to retrieve user details from authentication system.")
        # --- END OF CORRECTION ---


        # 4. Combine data using a map for efficiency and safety
        users_map = {}
        try:
            # Use the filtered_users_data list
            users_map = {str(u['id']): u.get('email') for u in filtered_users_data if 'id' in u}
        except Exception as e:
             logging.exception(f"Unexpected error creating users_map from filtered auth data: {e}")
             abort(500, description="Internal error processing user details.")

        # 5. Prepare final list safely
        users_with_roles = []
        for role_info in roles_result.data:
            user_id = str(role_info.get('user_id'))
            if user_id:
                users_with_roles.append({
                    "user_id": user_id,
                    "role": role_info.get('role', 'N/A'),
                    "email": users_map.get(user_id, "N/A") # Use map, default to N/A
                })

        logging.debug(f"Successfully prepared list of {len(users_with_roles)} users with roles.")
        return jsonify(users_with_roles)

    except Exception as e:
        logging.exception(f"An unexpected error occurred in get_users: {e}")
        abort(500, description="Failed to retrieve user list due to a server error.")


@app.route('/api/users/<uuid:user_id>/role', methods=['PUT'])
@token_required
# @roles_required('admin')
def assign_user_role(user_id):
    """Admin: Assign or update the role of a specific user."""
    data = request.get_json()
    if not data or 'role' not in data:
        abort(400, description="Missing 'role' field in request body.")

    new_role = data['role']
    allowed_roles = ('admin', 'manager', 'viewer')
    if new_role not in allowed_roles:
        abort(400, description=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")

    try:
        # Check if user exists in user_roles first
        old_result = supabase.table("user_roles").select("role").eq("user_id", str(user_id)).maybe_single().execute()

        if not old_result.data:
            # If user exists in auth but not user_roles (shouldn't happen with trigger, but handle defensively)
            # Check auth.users
            auth_user = supabase.table("users", schema="auth").select("id").eq("id", str(user_id)).maybe_single().execute()
            if not auth_user.data:
                 abort(404, description="User not found in authentication system.")
            # Insert new role if user exists in auth but not roles table
            result = supabase.table("user_roles").insert({"user_id": str(user_id), "role": new_role}).execute()
            action = "ASSIGN_ROLE"
            old_role = None
        else:
            # Update existing role
            old_role = old_result.data['role']
            if old_role == new_role:
                return jsonify({"message": "User already has this role."}), 200 # No change needed

            result = supabase.table("user_roles").update({"role": new_role}).eq("user_id", str(user_id)).execute()
            action = "UPDATE_ROLE"

        if not result.data:
             raise Exception("Failed to update/assign role, no data returned.")

        log_audit(
            action=action,
            table_name="user_roles",
            record_id=str(user_id),
            old_values={"role": old_role} if old_role else None,
            new_values={"role": new_role}
        )
        return jsonify({"user_id": str(user_id), "role": new_role})

    except Exception as e:
        logging.error(f"Error assigning role to user {user_id}: {e}")
        abort(500, description="Failed to assign user role.")


# == Reports and Alerts ==
@app.route('/api/alerts/low-stock', methods=['GET'])
@token_required
# @roles_required('admin', 'manager')
def get_low_stock_alerts():
    """Admin/Manager: Get items below the low stock threshold."""
    try:
        threshold = request.args.get('threshold', default=LOW_STOCK_THRESHOLD, type=int)
        result = supabase.table("items").select("id, name, quantity, category").lt("quantity", threshold).order("quantity").execute()
        return jsonify(result.data)
    except Exception as e:
        logging.error(f"Error fetching low stock items: {e}")
        abort(500, description="Failed to retrieve low stock alerts.")


@app.route('/api/reports/inventory/monthly', methods=['GET'])
@token_required
# @roles_required('admin')
def get_monthly_inventory_report():
    """Admin: Generate a monthly inventory report (basic: current snapshot)."""
    # More complex reports might involve querying audit logs or historical snapshots.
    # This basic version returns the current state, perhaps with valuation.
    try:
        year = request.args.get('year', default=datetime.utcnow().year, type=int)
        month = request.args.get('month', default=datetime.utcnow().month, type=int)

        # For a basic report, just fetch current inventory
        items_result = supabase.table("items").select("id, name, quantity, price, category").order("name").execute()

        total_value = sum(item['quantity'] * float(item['price']) for item in items_result.data)
        total_items = sum(item['quantity'] for item in items_result.data)
        distinct_item_count = len(items_result.data)

        report_data = {
            "report_month": f"{year}-{month:02d}",
            "generated_at": datetime.utcnow().isoformat(),
            "total_distinct_items": distinct_item_count,
            "total_units": total_items,
            "total_inventory_value": round(total_value, 2),
            "inventory_snapshot": items_result.data
        }

        log_audit(action="GENERATE_MONTHLY_REPORT", new_values={"month": f"{year}-{month:02d}"})
        return jsonify(report_data)

    except Exception as e:
        logging.error(f"Error generating monthly report: {e}")
        abort(500, description="Failed to generate monthly inventory report.")


# == Audit Logs ==
@app.route('/api/audit-logs', methods=['GET'])
@token_required
# @roles_required('admin')
def get_audit_logs():
    """Admin: View audit log entries with filtering."""
    try:
        # Basic Pagination (example)
        page = request.args.get('page', default=1, type=int)
        limit = request.args.get('limit', default=20, type=int)
        offset = (page - 1) * limit

        query = supabase.table("audit_logs").select("*", count="exact").order("timestamp", desc=True).range(offset, offset + limit - 1)

        # Filtering Examples (add more as needed)
        user_filter = request.args.get('user_id')
        action_filter = request.args.get('action')
        start_date = request.args.get('start_date') # Expect ISO format e.g., 2023-10-27T00:00:00Z

        if user_filter:
            query = query.eq('user_id', user_filter)
        if action_filter:
            query = query.eq('action', action_filter)
        if start_date:
             query = query.gte('timestamp', start_date)
        # Add end_date filter etc.

        result = query.execute()

        return jsonify({
            "data": result.data,
            "count": result.count
        })
    except Exception as e:
        logging.error(f"Error fetching audit logs: {e}")
        abort(500, description="Failed to retrieve audit logs.")


# == Bonus Features ==

@app.route('/api/items/<uuid:item_id>/trends', methods=['GET'])
@token_required
# @roles_required('admin', 'manager', 'viewer')
def get_item_trends(item_id):
    """Get historical quantity data for charting."""
    try:
        # Query audit logs for quantity changes for this specific item
        # We need actions like CREATE_ITEM, UPDATE_QUANTITY, UPDATE_ITEM (if quantity changed), BULK_UPDATE_QUANTITY
        # This requires parsing the 'new_values' or having dedicated quantity change logs.
        # Let's query for relevant actions and extract quantity.

        # Define relevant actions that signify a quantity change
        quantity_actions = ['CREATE_ITEM', 'UPDATE_QUANTITY', 'UPDATE_ITEM', 'BULK_UPDATE_QUANTITY'] # Add DELETE_ITEM if you want to show it going to 0

        # Fetch audit logs related to this item and quantity changes
        # Ordering by timestamp is crucial
        result = supabase.table("audit_logs") \
            .select("timestamp, action, new_values") \
            .eq("table_name", "items") \
            .eq("record_id", str(item_id)) \
            .in_("action", quantity_actions) \
            .order("timestamp", desc=False) \
            .execute()

        if not result.data:
            # If no history, maybe return current quantity?
             current_item = supabase.table("items").select("quantity, created_at").eq("id", str(item_id)).maybe_single().execute()
             if current_item.data:
                  return jsonify({
                       "labels": [current_item.data['created_at']],
                       "quantities": [current_item.data['quantity']]
                  })
             else:
                  return jsonify({"labels": [], "quantities": []}) # Item not found or no history


        # Process the logs to extract timestamp and quantity *at that time*
        labels = []
        quantities = []

        for log in result.data:
            timestamp = log['timestamp']
            new_values = log['new_values']
            quantity = None

            if isinstance(new_values, dict):
                if 'quantity' in new_values:
                    quantity = new_values['quantity']
                elif log['action'] == 'CREATE_ITEM' and 'quantity' in new_values: # Handle creation
                     quantity = new_values['quantity']
                elif log['action'] == 'BULK_UPDATE_QUANTITY' and 'updated_items' in new_values:
                     # Find this specific item in the bulk log
                     for item_log in new_values.get('updated_items', []):
                          if item_log.get('item_id') == str(item_id):
                               quantity = item_log.get('new_quantity')
                               break
                # Add handling for UPDATE_ITEM if quantity is nested differently

            # Only add data point if we successfully extracted a quantity
            if quantity is not None:
                 # Avoid duplicate timestamps if multiple logs happen at once (take latest)
                 if labels and labels[-1] == timestamp:
                      quantities[-1] = quantity
                 else:
                      labels.append(timestamp)
                      quantities.append(quantity)

        # Add current quantity as the last point if the last log isn't current
        # (Optional, but often useful for charts)
        # current_item = supabase.table("items").select("quantity, updated_at").eq("id", str(item_id)).maybe_single().execute()
        # if current_item.data and (not labels or labels[-1] < current_item.data['updated_at']):
        #      labels.append(current_item.data['updated_at'])
        #      quantities.append(current_item.data['quantity'])


        return jsonify({"labels": labels, "quantities": quantities})

    except Exception as e:
        logging.error(f"Error fetching trends for item {item_id}: {e}")
        abort(500, description="Failed to retrieve item trends.")

# --- TODO: Bonus Feature: Notifications ---
# This would typically involve:
# 1. A function `send_low_stock_notification(item)`
# 2. Integrating an email library (e.g., SendGrid, Mailgun) or push notification service.
# 3. Calling this function from `update_item_quantity` and `bulk_update_quantity`
#    when quantity drops below LOW_STOCK_THRESHOLD.
# 4. Consider using background tasks (Celery, RQ) for sending notifications
#    to avoid blocking the API request.
# Example placeholder:
# def send_low_stock_notification(item_id, item_name, quantity):
#     logging.info(f"NOTIFICATION: Item {item_name} (ID: {item_id}) is low on stock ({quantity})!")
#     # Add email/push logic here


# --- Base Route ---
@app.route('/')
def home():
    """A simple route to check if the server is running."""
    return jsonify({"message": "Flask inventory backend is running!"})

# --- Run the App ---
if __name__ == '__main__':
    # Use debug=True for development ONLY, it enables auto-reloading and detailed errors
    # Set host='0.0.0.0' to make it accessible on your network (e.g., from Next.js dev server)
    app.run(host='0.0.0.0', port=5001, debug=True)
