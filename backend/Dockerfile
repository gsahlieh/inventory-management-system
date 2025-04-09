FROM python:3.11.6-slim
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# Change the CMD to point to the 'app' variable inside the 'run.py' module
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "run:app"]
