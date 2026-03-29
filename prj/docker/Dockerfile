FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (minimal). "ca-certificates" for HTTPS, "curl" for healthcheck/debug.
RUN apt-get update && apt-get install -y --no-install-recommends       ca-certificates curl     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the app
COPY . /app

# Ensure upload folder exists
RUN mkdir -p /app/Colorcat/uploads

EXPOSE 8080

# Use gunicorn for production-like runs
CMD ["sh", "-c", "gunicorn -w 4 -k gthread --threads 4 \
  --timeout 0 \
  --keep-alive 5 \
  --graceful-timeout 30 \
  -b 0.0.0.0:8080 app:app"]
