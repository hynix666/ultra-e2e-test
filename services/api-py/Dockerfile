# The base image is pinned by digest as well as tag: a tag can be repointed at a different image.
# Dependabot updates both together.
FROM python:3.14-slim@sha256:cad9a2c871761c413caa6fdd6441c783451e740a48aaeba60ae62a8b53525ef6
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src
# No runtime dependencies, so nothing is installed: the service is the standard library plus this
# source tree. A project that adds dependencies installs them here from the committed uv.lock.
COPY src ./src
USER nobody
EXPOSE 8080
CMD ["python", "-m", "api_py.main"]
