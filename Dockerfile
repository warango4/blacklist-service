FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=blacklist

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY application.py .
COPY blacklist ./blacklist

RUN useradd --create-home --uid 1000 appuser
USER appuser

EXPOSE 8000

# newrelic-admin carga el agente antes de la app; se configura con variables NEW_RELIC_*.
CMD ["newrelic-admin", "run-program", "gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "application:application"]
