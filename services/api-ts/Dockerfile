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
EXPOSE 8080
CMD ["node", "src/main.ts"]
