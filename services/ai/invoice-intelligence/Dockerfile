FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/invoice-intelligence
COPY services/ai/invoice-intelligence/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ai/invoice-intelligence/app ./app

RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /srv/invoice-intelligence
USER appuser
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health/ready', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
