# https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
FROM node:{{node_version}}{{node_version_tag}}
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

COPY . .

EXPOSE 8080
ENV PORT 8080
CMD ["node", "server.js"]