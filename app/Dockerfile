# FROM node:18-alpine
FROM public.ecr.aws/docker/library/node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
