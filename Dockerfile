FROM node:17
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build

CMD [ "npx", "http-server",  "dist", "--port", "8080"]