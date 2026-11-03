FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY server/account-server.js ./account-server.js
ENV ACCOUNT_HOST=0.0.0.0 ACCOUNT_PORT=8787 ACCOUNT_DATA_DIR=/data
EXPOSE 8787
CMD ["node", "account-server.js"]
