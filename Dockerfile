FROM node:20-alpine

WORKDIR /app

COPY server.js .
COPY index.html .
COPY styles.css .
COPY app.js .

ENV PORT=3000
ENV CACHE_TTL=3600000

EXPOSE 3000

CMD ["node", "server.js"]