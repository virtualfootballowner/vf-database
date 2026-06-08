# Railway / Docker — clean npm ci (no cached node_modules/.cache from Nixpacks layers).
# ECR Public mirrors Docker Hub library images — avoids Docker Hub 504/rate-limit on Railway builders.
FROM public.ecr.aws/docker/library/node:20-alpine

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
