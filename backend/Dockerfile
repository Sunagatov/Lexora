FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy dependency manifest first so this layer is cached unless deps change
COPY pyproject.toml requirements.lock ./
# Install dependencies without the local package (no source needed yet)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --require-hashes -r requirements.lock

# Copy the rest of the source and install the local package
COPY . .
RUN pip install --no-cache-dir --no-deps -e .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
