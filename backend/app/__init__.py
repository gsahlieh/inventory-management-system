# backend/app/__init__.py
import os
import logging
from dotenv import load_dotenv
from flask import Flask, jsonify, g
from flask_cors import CORS
from supabase import create_client, Client

# --- Load Environment Variables ---
# Load from .env file in the root directory if it exists
dotenv_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(dotenv_path=dotenv_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# --- Basic Logging Setup ---
# Consider adjusting level for production (e.g., logging.INFO)
logging.basicConfig(level=logging.DEBUG)

# --- Environment Variable Validation ---
missing_vars = []
if not SUPABASE_URL:
    missing_vars.append("SUPABASE_URL")
if not SUPABASE_KEY:
    missing_vars.append("SUPABASE_SERVICE_ROLE_KEY")
if missing_vars:
    # Log error and raise, preventing app start
    error_msg = f"Missing environment variables: {', '.join(missing_vars)}"
    logging.critical(error_msg)
    raise ValueError(error_msg)

logging.info(f"Supabase URL loaded: {SUPABASE_URL is not None}")
logging.info(f"Frontend URL: {FRONTEND_URL}")

# --- Supabase Client Initialization ---
# Initialize globally within this module so utils/routes can import it
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logging.info(
        "Supabase client initialized successfully (using Service Role Key)."
    )
except Exception as e:
    logging.error(f"Failed to initialize Supabase client: {e}")
    raise


def create_app():
    """Application Factory Function"""
    app = Flask(__name__)

    # --- CORS Configuration ---
    logging.info(f"Configuring CORS for origin: {FRONTEND_URL}")
    CORS(
        app,
        resources={r"/api/*": {"origins": FRONTEND_URL}},
        supports_credentials=True,
    )

    # --- Register Blueprints ---
    # Import blueprints here to avoid circular dependencies
    from .routes.items import items_bp
    from .routes.users import users_bp
    from .routes.reports import reports_bp
    from .routes.audit import audit_bp
    from .routes.misc import misc_bp, base_bp # Import both from misc

    app.register_blueprint(items_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(misc_bp)
    app.register_blueprint(base_bp) # Register the base route blueprint

    # --- Global Error Handlers ---
    # These handlers apply to the entire application, including blueprints
    @app.errorhandler(400)
    def bad_request(e):
        logging.warning(f"Bad Request: {getattr(e, 'description', str(e))}")
        return jsonify(error=str(getattr(e, 'description', 'Bad Request'))), 400

    @app.errorhandler(401)
    def unauthorized(e):
        logging.warning(f"Unauthorized: {getattr(e, 'description', str(e))}")
        return jsonify(error=str(getattr(e, 'description', 'Unauthorized'))), 401

    @app.errorhandler(403)
    def forbidden(e):
        logging.warning(f"Forbidden: {getattr(e, 'description', str(e))}")
        return jsonify(error=str(getattr(e, 'description', 'Forbidden'))), 403

    @app.errorhandler(404)
    def not_found(e):
        logging.warning(f"Not Found: {getattr(e, 'description', str(e))}")
        # Check if it's our custom abort or a standard 404
        desc = getattr(e, 'description', 'Not Found')
        return jsonify(error=str(desc)), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        # Log the full exception details
        error_details = getattr(e, 'original_exception', str(e))
        description = getattr(e, 'description', str(error_details))
        logging.exception(f"Internal Server Error: {description}") # Log traceback
        # Return a generic message to the client
        return jsonify(error="An internal server error occurred."), 500

    return app

