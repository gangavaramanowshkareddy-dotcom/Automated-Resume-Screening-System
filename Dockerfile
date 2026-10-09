FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/home/appuser \
    EASYOCR_MODULE_PATH=/home/appuser/.EasyOCR

WORKDIR /app

# PyTorch/EasyOCR require the OpenMP runtime on slim Debian images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# EasyOCR uses PyTorch; install CPU-only wheels to avoid pulling CUDA packages.
RUN python -m pip install --no-cache-dir --timeout 180 --retries 5 \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.13.0+cpu torchvision==0.28.0+cpu \
    && sed -E '/^torch==/d; /^torchvision==/d' requirements.txt > requirements.docker.txt \
    && python -m pip install --no-cache-dir --timeout 180 --retries 5 -r requirements.docker.txt

COPY . .
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /app/uploads /home/appuser/.EasyOCR \
    && chown -R appuser:appuser /app /home/appuser

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
