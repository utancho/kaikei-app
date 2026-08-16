# Kaikei — single-stage production image.
# ビルドとランタイムを1つのステージにまとめたシンプルな構成(この環境にDockerが
# ないため未検証です。デプロイ前に一度ローカルの `docker build` で確認してください)。

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci

COPY . .

RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=server/prisma/schema.prisma && node server/dist/index.js"]
