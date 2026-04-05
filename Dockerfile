# Use a lightweight python image
FROM python:3.10-slim

# Set working directory inside the container
WORKDIR /app

# Prevent python from writing pyc files to disk and set stdout buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies first (for better docker caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application files
COPY . .

# Create a non-root user and change ownership of the app directory
RUN useradd -m appuser && chown -R appuser:appuser /app

# Switch to the non-root user
USER appuser

# Expose the standard port the app runs on
EXPOSE 5000

# Run the app securely using gunicorn instead of the flask dev server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
