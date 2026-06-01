# Railway / Docker — clean npm ci (no cached node_modules/.cache from Nixpacks layers).
FROM node:20-alpine

WORKDIR /app

ENV npm_config_cache=/tmp/npm-cache
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Web service: set Railway variable RUN_NEXT_BUILD=true and start command `npm start`
ARG RUN_NEXT_BUILD=false
RUN if [ "$RUN_NEXT_BUILD" = "true" ]; then npm run build; fi

EXPOSE 3000

CMD ["npm", "start"]
