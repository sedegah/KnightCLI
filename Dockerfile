FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Use exec form to ensure signals are properly handled
ENTRYPOINT ["python"]
CMD ["-u", "main.py"]
