# Use the official Python image matching your version
FROM python:3.11.6-slim

# Set environment variables to prevent Python from buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for psycopg2)
# RUN apt-get update && apt-get install -y --no-install-recommends some-package && rm -rf /var/lib/apt/lists/*

# Copy the requirements file first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
# --no-cache-dir reduces image size
RUN pip install --no-cache-dir -r requirements.txt

# Add gunicorn for production-ready serving (add 'gunicorn' to your requirements.txt)
# RUN pip install --no-cache-dir gunicorn

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (must match the CMD and NEXT_PUBLIC_API_BASE_URL)
EXPOSE 8000

# Command to run the application
# Use gunicorn for better performance/stability in production (and on Render)
# Replace 'your_flask_app_module:app' with your actual Flask app entry point
# Example: if your main file is app.py and Flask instance is named 'app', use 'app:app'
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]

# --- OR ---
# For simpler local testing (less recommended for production/Render):
# CMD ["flask", "run", "--host=0.0.0.0", "--port=8000"]
