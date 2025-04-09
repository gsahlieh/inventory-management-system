# backend/app/routes/users.py
import logging
from flask import Blueprint, jsonify, request, abort, g
import uuid # Import uuid

# Import decorators, helpers, and supabase client
from ..utils.auth import token_required, roles_required
from ..utils.helpers import log_audit
from .. import supabase # Import the initialized Supabase client

# Create Blueprint
users_bp = Blueprint("users", __name__, url_prefix="/api/users")


# == User Role Management ==
@users_bp.route("", methods=["GET"])
@token_required
@roles_required("admin")
def get_users():
    """Admin: List users and their roles."""
    logging.debug("Attempting to fetch users and roles...")
    try:
        logging.debug("Fetching data from user_roles...")
        roles_result = supabase.table("user_roles").select("user_id, role").execute()

        if not hasattr(roles_result, "data"):
            logging.error(
                f"Unexpected response structure from user_roles query: {roles_result}"
            )
            abort(500, description="Failed to retrieve roles (unexpected response).")

        logging.debug(f"Fetched {len(roles_result.data)} roles from user_roles.")
        if not roles_result.data:
            logging.info("No users found in user_roles table.")
            return jsonify([])

        user_ids = []
        try:
            for u in roles_result.data:
                user_id = u.get("user_id")
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

        logging.debug(f"Fetching emails for {len(user_ids)} users from auth.users...")
        try:
            # Use the admin API to list users
            list_users_response = supabase.auth.admin.list_users()

            # Handle potential pagination or different response structures
            auth_users_list = []
            if isinstance(list_users_response, list):
                auth_users_list = list_users_response # Direct list response
            elif hasattr(list_users_response, 'users'):
                auth_users_list = list_users_response.users # Response object with 'users' attribute
            else:
                logging.error(f"Unexpected response type from list_users: {type(list_users_response)}")
                abort(500, description="Failed to parse user list from authentication system.")


            # Filter the list from auth based on IDs found in user_roles
            filtered_users_data = [
                {"id": str(user.id), "email": getattr(user, 'email', 'N/A')}
                for user in auth_users_list
                if str(user.id) in user_ids
            ]
            logging.debug(f"Filtered {len(filtered_users_data)} users from auth list.")

        except Exception as e:
            logging.exception(f"Error calling supabase.auth.admin.list_users(): {e}")
            abort(
                500,
                description="Failed to retrieve user details from authentication system.",
            )

        users_map = {}
        try:
            users_map = {
                str(u["id"]): u.get("email")
                for u in filtered_users_data
                if "id" in u
            }
        except Exception as e:
            logging.exception(
                f"Unexpected error creating users_map from filtered auth data: {e}"
            )
            abort(500, description="Internal error processing user details.")

        users_with_roles = []
        for role_info in roles_result.data:
            user_id = str(role_info.get("user_id"))
            if user_id:
                users_with_roles.append(
                    {
                        "user_id": user_id,
                        "role": role_info.get("role", "N/A"),
                        "email": users_map.get(user_id, "N/A"), # Use N/A if email not found
                    }
                )

        logging.debug(
            f"Successfully prepared list of {len(users_with_roles)} users with roles."
        )
        return jsonify(users_with_roles)

    except Exception as e:
        logging.exception(f"An unexpected error occurred in get_users: {e}")
        abort(500, description="Failed to retrieve user list due to a server error.")


@users_bp.route("/<uuid:user_id>/role", methods=["GET"])
@token_required
@roles_required("admin", "manager", "viewer")
def get_user_role(user_id):
    """Get the role of a specific user."""
    target_user_id = str(user_id)
    logging.debug(f"Attempting to fetch role for user_id: {target_user_id}")

    try:
        result = (
            supabase.table("user_roles")
            .select("role")
            .eq("user_id", target_user_id)
            .maybe_single()
            .execute()
        )

        if not result.data:
            # Check if user exists in auth before declaring role not found
            try:
                # Use the admin API to check user existence by ID
                user_check = supabase.auth.admin.get_user_by_id(target_user_id)
                # If get_user_by_id succeeds, the user exists in auth
                logging.warning(
                    f"User {target_user_id} exists in auth but not in user_roles table."
                )
                # Still return 404 for the role, but log indicates potential inconsistency
                abort(404, description="User role not found or assigned.")
            except Exception as auth_e:
                # Handle specific "user not found" error from auth API if possible
                # This depends on the exact exception raised by supabase-py/gotrue-py
                if "User not found" in str(auth_e): # Example check
                    logging.warning(f"User {target_user_id} not found in auth system.")
                    abort(404, description="User not found.")
                else:
                    # Log other errors during the auth check but proceed with role not found
                    logging.error(f"Error checking user existence in auth: {auth_e}")
                    abort(404, description="User role not found.") # Role definitely not found

        user_role = result.data.get("role")
        if not user_role:
            logging.warning(f"Role data is missing for user_id: {target_user_id}")
            abort(404, description="User role data is incomplete.")

        logging.debug(
            f"Successfully fetched role '{user_role}' for user_id: {target_user_id}"
        )
        return jsonify({"user_id": target_user_id, "role": user_role}), 200

    except Exception as e:
        # Catch errors from the initial role fetch or unexpected issues
        logging.exception(f"Error fetching role for user {target_user_id}: {e}")
        abort(500, description="Failed to retrieve user role due to a server error.")


@users_bp.route("/<uuid:user_id>/role", methods=["PUT"])
@token_required
@roles_required("admin")
def assign_user_role(user_id):
    """Admin: Assign or update the role of a specific user."""
    data = request.get_json()
    if not data or "role" not in data:
        abort(400, description="Missing 'role' field in request body.")

    new_role = data["role"]
    allowed_roles = ("admin", "manager", "viewer")
    if new_role not in allowed_roles:
        abort(
            400,
            description=f"Invalid role. Must be one of: {', '.join(allowed_roles)}",
        )

    target_user_id = str(user_id)

    try:
        # Check if user exists in auth system first
        try:
            supabase.auth.admin.get_user_by_id(target_user_id)
            logging.debug(f"User {target_user_id} confirmed to exist in auth.")
        except Exception as auth_e:
            if "User not found" in str(auth_e): # Example check
                logging.warning(f"Attempted to assign role to non-existent user: {target_user_id}")
                abort(404, description="User not found in authentication system.")
            else:
                logging.error(f"Error checking user existence in auth before role assignment: {auth_e}")
                abort(500, description="Failed to verify user existence.")


        # Check current role in user_roles table
        old_result = (
            supabase.table("user_roles")
            .select("role")
            .eq("user_id", target_user_id)
            .maybe_single()
            .execute()
        )

        old_role = None
        action = "ASSIGN_ROLE" # Default action

        if old_result.data:
            old_role = old_result.data.get("role")
            if old_role == new_role:
                return jsonify({"message": "User already has this role."}), 200
            action = "UPDATE_ROLE" # Change action if role exists

        # Perform Upsert (Insert or Update)
        # Use upsert to handle both cases: user exists in auth but not user_roles, or user exists in both
        result = (
            supabase.table("user_roles")
            .upsert({"user_id": target_user_id, "role": new_role})
            .execute()
        )

        # Check if upsert was successful (response structure might vary)
        if not result.data:
             # Log potential issue, but proceed assuming success if no error raised
             logging.warning(f"Upsert for user {target_user_id} role returned no data, but no error raised.")
             # Consider adding more robust check based on actual Supabase client behavior

        log_audit(
            action=action,
            table_name="user_roles",
            record_id=target_user_id,
            old_values={"role": old_role} if old_role else None,
            new_values={"role": new_role},
        )
        return jsonify({"user_id": target_user_id, "role": new_role})

    except Exception as e:
        logging.exception(f"Error assigning role to user {target_user_id}: {e}")
        abort(500, description="Failed to assign user role.")

