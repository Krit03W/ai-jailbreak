# เกมแฮก AI ผู้พิทักษ์ฐานทัพดาวอังคาร — ไม่มี dependency ให้ติดตั้ง ใช้ built-in ของ Node ล้วน
FROM node:22-alpine

WORKDIR /app

# คัดลอกเฉพาะไฟล์ที่ต้องใช้รัน
COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# healthcheck ให้ Dokploy/Traefik รู้ว่าแอปพร้อมใช้งาน
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/state >/dev/null 2>&1 || exit 1

# รันตรง ๆ (env มาจาก Dokploy ไม่ต้องใช้ไฟล์ .env)
CMD ["node", "server.js"]
