# Deploy to Vercel Guide

Your project is now restructured for Vercel deployment! Here's how to deploy:

## Project Structure
```
bike-spare-saas/
├── api/                      # Node.js backend (Vercel serverless functions at /api)
│   ├── src/
│   ├── index.js             # Entry point for serverless
│   ├── package.json
│   └── .env                 # MongoDB URI, JWT_SECRET, etc.
├── frontend/                # React frontend (deployed to root domain /)
│   ├── src/
│   ├── package.json
│   ├── .env                 # Development env vars
│   └── .env.production      # Production env vars (auto-used by Vercel)
├── package.json             # Root workspace config
├── vercel.json              # Vercel deployment config
└── .gitignore
```

## Step 1: Initialize Git

```bash
cd /Users/azfarbilal/Downloads/bike-spare-saas
git init
git add .
git commit -m "Initial commit: restructured for Vercel deployment"
```

## Step 2: Push to GitHub

1. Create a new repository on GitHub (https://github.com/new)
2. Name it `bike-spare-saas`
3. In your terminal:
```bash
git remote add origin https://github.com/YOUR_USERNAME/bike-spare-saas.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to https://vercel.com and sign in (or create account)
2. Click "New Project"
3. Select your GitHub repository: `bike-spare-saas`
4. Vercel auto-detects the monorepo structure
5. Set Environment Variables:
   - `MONGO_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Your JWT secret key
   - `NODE_ENV`: production
6. Click "Deploy"

### Option B: Via Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

## Environment Variables to Set in Vercel

Go to Project Settings → Environment Variables and add:

| Variable | Value | Required |
|----------|-------|----------|
| `MONGO_URI` | Your MongoDB connection string | ✅ Yes |
| `JWT_SECRET` | Your JWT secret key | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `PORT` | `3000` (auto-set by Vercel) | ❌ No |

## What Happens After Deploy

1. ✅ **Frontend** deploys to: `https://your-project.vercel.app`
2. ✅ **API** deploys to: `https://your-project.vercel.app/api/*`
   - `/api/auth` → handles authentication
   - `/api/products` → product CRUD
   - `/api/sales` → sales tracking
   - `/api/returns` → return processing
   - `/api/purchase-orders` → PO management

3. ✅ Frontend automatically uses `/api` for all backend calls (no hardcoded localhost!)

## Local Development

### Run Both Frontend & Backend
```bash
npm run dev
```
This runs:
- Frontend on http://localhost:5173
- Backend on http://localhost:5001

### Build for Production
```bash
npm run build
```

## Verification Checklist

- [ ] Repository pushed to GitHub
- [ ] Vercel project created and linked
- [ ] Environment variables set in Vercel
- [ ] Build completes successfully
- [ ] Frontend loads at `https://your-project.vercel.app`
- [ ] API responds at `https://your-project.vercel.app/api/health`
- [ ] Login works with MongoDB
- [ ] Products display correctly
- [ ] Purchase Orders, Returns, Sales all work

## Troubleshooting

### "Failed to build"
- Check logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Make sure MongoDB connection string is valid

### "API returns 404"
- Verify routes don't have `/api` prefix (already fixed in latest code)
- Check that `api/index.js` exists
- Confirm environment variables are set

### "Frontend can't connect to API"
- Verify `VITE_API_URL=/api` is set in Vercel env vars
- Check browser console for CORS errors
- Ensure MongoDB URI is accessible from Vercel

## After Deployment

Your live app is now running! You can:
- ✅ Access admin dashboard at `/admin`
- ✅ View purchase orders at `/admin/purchase-orders`
- ✅ Process sales at `/sales`
- ✅ Process returns from sales dashboard
- ✅ Manage inventory and view returns in admin

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas
- **Project Issues**: Check Vercel logs for error messages
