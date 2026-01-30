# Kinofan — Watch together

Do‘stlar bilan bir vaqtda kino ko‘ring, kamerada ko‘ring va chatda gapling. Host qurilmasidan video tanlaydi; video WebRTC orqali mehmonlarga strim qilinadi (serverda saqlanmaydi).

## Ikki rejim

- **Supabase** (tavsiya etiladi): xonalar, chat va signaling Supabase (PostgreSQL + Realtime) orqali. Node server kerak emas.
- **Node server**: Socket.io backend — xonalar va chat serverda (in-memory). Supabase sozlanmagan bo‘lsa ishlatiladi.

Ilova `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY` berilgan bo‘lsa Supabase rejimiga o‘tadi, aks holda Node serverga ulanadi.

## Supabase sozlash

1. [Supabase](https://supabase.com) da loyiha yarating.
2. **SQL Editor** da `supabase/migrations/001_initial.sql` faylini bajarib, `rooms` va `messages` jadvalini va RLS ni yarating.
3. **Database → Publications** da `messages` jadvalini `supabase_realtime` publication ga qo‘shing (migration buni qiladi).
4. **Settings → API** dan Project URL va anon key ni oling.
5. `client/.env` yarating:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

## Ishga tushirish (development)

### Supabase rejimi (Node server kerak emas)

```bash
cd client
npm install
npm run dev
```

Brauzerda `http://localhost:5173` oching. **Xona yaratish** bosing.

### Node server rejimi

1. **Backend** (loyiha ildizidan):
   ```bash
   cd server
   npm install
   npm start
   ```
   Server `http://localhost:3001` da ishlaydi.

2. **Frontend** (yana bir terminalda):
   ```bash
   cd client
   npm install
   npm run dev
   ```
   `client/.env` da Supabase o‘zgaruvchilarini bermang yoki ularni o‘chiring — shunda ilova Socket.io serverga ulanadi.

3. **Foydalanish**
   - Brauzerda `http://localhost:5173` oching.
   - **Xona yaratish** bosing. Kameraga ruhsat bering.
   - Galereyadan video tanlang.
   - **Invite** bosing va linkni ulashing. Boshqalar link orqali kirib, kameraga ruhsat berib, bir xil videoni va kameralarni ko‘radi; chatda yozishadi.

## Production build va alohida deploy

Backend va frontend **alohida** deploy qilinadi: server statik fayl serve qilmaydi, faqat API va Socket.io.

### Frontend (client)

1. **Build**:
   ```bash
   cd client
   npm install
   npm run build
   ```
   `client/dist` yaratiladi.

2. **Environment** (hosting env yoki `.env.production`):
   - **Supabase**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - **Node server** ishlatilsa: `VITE_API_URL` — backend URL (masalan `https://api.kinofan.example.com`, oxirida `/` siz).

3. **Deploy**: Vercel, Netlify, Cloudflare Pages yoki boshqa statik/SPA hosting. `client/dist` ni root yoki build output qilib ko‘rsating.

### Backend (server) — faqat Node server rejimida

1. **Environment** (`server/.env`): `PORT=3001`, `CORS_ORIGIN` — frontend domeni (masalan `https://kinofan.vercel.app`). Bir nechta domen: vergul bilan yoki hujjatda ko‘rsatilgan format.

2. **Deploy**: Railway, Render, Fly.io yoki boshqa Node hosting. Faqat `server/` papkasi (client/dist serve qilinmaydi).

### HTTPS

Production da kamera va WebRTC uchun HTTPS talab qilinadi.

## Texnologiyalar

- **Supabase**: PostgreSQL (rooms, messages), Realtime (presence, broadcast signaling, postgres changes for chat).
- **Backend** (ixtiyoriy): Node.js, Express, Socket.io.
- **Frontend**: React (Vite), React Router.
- **Real-time**: WebRTC (host kino + webcam strim); Supabase Realtime yoki Socket.io (signaling, chat).

## PWA (mobil qurilmada o‘rnatish)

Production build da Service Worker yoziladi (vite-plugin-pwa). Brauzerda “Qurilmaga o‘rnatish” / “Add to Home Screen” orqali ilovani uy sahifasiga qo‘shish mumkin. Offline da bosh sahifa va cache’langan asset’lar ishlaydi; API va Realtime internet kerak.

Ikonlar: `client/public/icons/` da `icon-192.png` va `icon-512.png` qo‘shilsa yaxshiroq; hozir `icon.svg` ishlatiladi.

## Mobile native app (Capacitor)

Xuddi shu kod bazasini App Store / Play Store uchun native ilova qilish mumkin:

1. Client build: `cd client && npm run build`.
2. Capacitor o‘rnatish: `npm i @capacitor/core @capacitor/cli`, loyiha ildizida `npx cap init` (ilova nomi, id, `client/dist` ni `webDir` qilib belgilang).
3. Platform qo‘shish: `npx cap add ios`, `npx cap add android`.
4. Build va sync: `npm run build` (client da), keyin `npx cap sync`, `npx cap open ios` yoki `npx cap open android`.

Batafsil: [Capacitor Docs](https://capacitorjs.com/docs).

## Eslatmalar

- Video faqat host qurilmasida; serverga yuklanmaydi.
- 2–5 kishi uchun qulay; ko‘proq ishtirokchida SFU kerak bo‘lishi mumkin.
- Production da HTTPS ishlatish kamerada va WebRTC da barqaror ishlash uchun muhim.
