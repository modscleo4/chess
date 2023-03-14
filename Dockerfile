FROM node:18-alpine

WORKDIR /app

COPY . .
RUN rm -f .env

RUN npm ci; \
  npx prisma generate; \
  npm run build; \
  npm run generateKeys; \
  npm prune --production

EXPOSE 3000

CMD ["npm", "run", "start"]
