FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY tools/time-test-server.js ./tools/time-test-server.js
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV PORT=8080 WERKZ_TIME_DATA_DIR=/data
EXPOSE 8080
CMD ["node","tools/time-test-server.js"]
