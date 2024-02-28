FROM node:18-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk add --no-cache g++ make py3-pip
RUN apk update

# Set working directory
WORKDIR /home
COPY . .
RUN yarn install
RUN yarn build

FROM base AS runner
WORKDIR /home

COPY --from=builder /home/dist ./dist
COPY --from=builder /home/node_modules ./node_modules/
COPY --from=builder /home/package*.json ./

COPY .env .

EXPOSE 3000

CMD ["node", "dist/main.js"]
