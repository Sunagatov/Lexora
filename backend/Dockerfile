FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy dependency manifest first so this layer is cached unless deps change
COPY pyproject.toml .
# Install dependencies without the local package (no source needed yet)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir $(python -c 'import tomllib; f=open("pyproject.toml","rb"); d=tomllib.load(f); print(" ".join(d.get("project",{}).get("dependencies",[])))')

# Copy the rest of the source and install the local package
COPY . .
RUN pip install --no-cache-dir -e .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log"]
