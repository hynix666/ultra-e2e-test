# The base image is pinned by digest as well as tag: a tag can be repointed at a different image.
# Dependabot updates both together.
FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Node 24 runs TypeScript directly by stripping types, so the sources ship as they are.
COPY src ./src
USER node
# The MCP Registry verifies that whoever publishes server.json owns this image by reading this label;
# it must equal "name" in server.json exactly. The source label links the image to the repository.
LABEL io.modelcontextprotocol.server.name="io.github.hynix666/ultra-e2e-test"
LABEL org.opencontainers.image.source="https://github.com/hynix666/ultra-e2e-test"
# No EXPOSE and no port: the protocol is stdin and stdout, so run this image with -i.
CMD ["node", "src/main.ts"]
