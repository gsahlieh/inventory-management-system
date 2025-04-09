# backend/run.py
import os
from app import create_app

# Create the Flask app instance using the factory
# Pass environment ('development', 'production', etc.) if needed for config
app = create_app()

if __name__ == "__main__":
    # For local development without Gunicorn (optional)
    # Use the port you were using locally, e.g., 5001
    port = int(os.environ.get("PORT", 5001))
    # Note: Use debug=True only in development!
    app.run(host="0.0.0.0", port=port, debug=False)
