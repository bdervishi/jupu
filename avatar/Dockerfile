FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server ./server
COPY client ./client

EXPOSE 8080
CMD ["python", "-m", "server.main"]
