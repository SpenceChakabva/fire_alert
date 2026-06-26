FROM python:3.11-slim

WORKDIR /app

# Install system deps needed by geopandas / shapely
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create output dir so the volume mount has a target
RUN mkdir -p /app/output

CMD ["uvicorn", "src.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
