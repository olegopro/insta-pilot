FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

EXPOSE 9000

CMD ["npx", "quasar", "dev", "--hostname", "0.0.0.0"]
