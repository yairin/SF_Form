# דימוי לפריסת שרת ה-API ל-Cloud Run (מאחורי Firebase Hosting).
FROM node:20-slim

WORKDIR /app

# התקנת תלויות פרודקשן בלבד.
COPY package*.json ./
RUN npm ci --omit=dev

# העתקת קוד המקור.
COPY . .

ENV NODE_ENV=production
# Cloud Run מזריק PORT (בד"כ 8080); server.js קורא process.env.PORT.
EXPOSE 8080

CMD ["node", "server.js"]
