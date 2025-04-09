# backend/app/utils/auth.py
import logging
from functools import wraps
from flask import request, jsonify, g, abort

# Import the globally initialized supabase client from the app package
from .. import supabase


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
                logging.warning(
                    f"Invalid Authorization header format: {auth_header}"
                )
                # Use abort for standard error handling
                abort(401, description="Invalid Authorization header format")
        else:
            logging.warning("Authorization header is missing.")
            abort(401, description="Authorization header is missing")

        if not token:
            # Should be caught above, but double-check
            logging.warning("Authorization token is missing.")
            abort(401, description="Token is missing")

        try:
            logging.debug(
                "Attempting to validate token with supabase.auth.get_user..."
            )
            # Use the imported supabase client's auth methods
            user_response = supabase.auth.get_user(jwt=token)

            if user_response and user_response.user:
                g.user = user_response.user
                g.user_id = user_response.user.id
                g.user_email = getattr(user_response.user, 'email', None) # Safely get email
                logging.info(
                    f"Token validated successfully via Supabase for user: {g.user_id} ({g.user_email or 'No email'})"
                )
            else:
                logging.error(
                    f"supabase.auth.get_user succeeded but returned invalid data: {user_response}"
                )
                abort(
                    500, description="Authentication check failed unexpectedly."
                )

        except Exception as e:
            # Check if it's likely an AuthApiError (adjust based on actual exception type if needed)
            if hasattr(e, 'message') and hasattr(e, 'status'):
                logging.warning(
                    f"Token validation failed via Supabase: {e.message} (Status: {e.status})"
                )
                if "invalid JWT" in str(e.message).lower():
                    msg = "Invalid token provided."
                elif "JWT expired" in str(e.message).lower():
                    msg = "Token has expired."
                else:
                    msg = "Authentication failed."
                abort(401, description=msg) # Use abort
            else:
                # Catch any other unexpected errors
                logging.exception(
                    f"An unexpected error occurred during Supabase token validation: {e}"
                )
                abort(
                    500,
                    description="An unexpected error occurred during authentication.",
                )

        return f(*args, **kwargs)

    return decorated_function


def roles_required(*required_roles):
    """Decorator factory to check user roles (using g.user_id set by token_required)."""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, "user_id") or not g.user_id:
                logging.error(
                    "roles_required used without preceding successful token_required."
                )
                abort(
                    500,
                    description="Server configuration error: User context not available after authentication.",
                )

            user_id = g.user_id
            logging.debug(
                f"Checking roles for user: {user_id}. Required: {required_roles}"
            )
            try:
                # Use the imported supabase client
                result = (
                    supabase.table("user_roles")
                    .select("role")
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )

                if not result.data:
                    logging.warning(
                        f"No role found in 'user_roles' table for user_id: {user_id}"
                    )
                    # Consider checking auth.users here if necessary
                    abort(
                        403,
                        description="User role not assigned. Please contact an administrator.",
                    )

                user_role = result.data.get("role")
                g.user_role = user_role # Store role in context

                if user_role not in required_roles:
                    logging.warning(
                        f"Authorization failed: User {user_id} with role '{user_role}' attempted action requiring roles: {required_roles}"
                    )
                    abort(
                        403,
                        description=f"Access forbidden: Requires role(s) {', '.join(required_roles)}",
                    )

                logging.debug(
                    f"User {user_id} authorized with role: {user_role}"
                )

            except Exception as e:
                logging.exception(f"Error fetching role for user {user_id}: {e}")
                abort(500, description="Error checking user permissions.")

            return f(*args, **kwargs)

        return decorated_function

    return decorator

