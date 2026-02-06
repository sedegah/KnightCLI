FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port for health checks and Render detection
EXPOSE 8080

# Use exec form to ensure signals are properly handled
ENTRYPOINT ["python"]
CMD ["-u", "main.py"]
