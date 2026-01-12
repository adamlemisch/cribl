FROM node:20-alpine

WORKDIR /app

COPY app.js /app/
COPY agent/ /app/agent/
COPY splitter/ /app/splitter/
COPY target/ /app/target/

EXPOSE 9997 9998 9999

CMD ["node", "app.js"]