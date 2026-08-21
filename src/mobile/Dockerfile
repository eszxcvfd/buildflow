FROM node:20.11.1-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts
COPY app.json babel.config.js metro.config.js tsconfig.json ./
COPY app ./app
COPY src ./src
EXPOSE 19006
# Expo web (Metro) serves on 19006; healthcheck hits web root
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:19006/ || exit 1
CMD ["npm", "start"]
