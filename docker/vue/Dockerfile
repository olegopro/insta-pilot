FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY . .
RUN npm install

EXPOSE 9000

CMD ["sh", "-c", "npm install && npx quasar dev --hostname 0.0.0.0"]
