FROM node:16.18 as development
ENV LANG C.UTF-8
ENV NODE_ENV development
WORKDIR /app

COPY ["./app/package.json", "./app/package-lock.json", "/app/"]
ENV HOST 0.0.0.0
ENV PORT 3000
EXPOSE 3000
RUN npm install
COPY ./app/ /app/
CMD ["npm", "run", "start"]

FROM node:16.18 as builder
WORKDIR /app
COPY package*.json /app
COPY --from=development /app/node_modules /app/node_modules
COPY ./app/ /app/
RUN npm run build
ENV NODE_ENV production
ENV LANG C.UTF-8
RUN npm ci --only=production && npm cache clean --force

FROM node:16.18 as production
ENV NODE_ENV production
ENV HOST 0.0.0.0
ENV PORT 3000
ENV NODE_ENV production
EXPOSE 3000
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
CMD ["node", "/app/dist/main.js"]
