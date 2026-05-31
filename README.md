# Bike Spare Parts SaaS Dashboard

A full-stack SaaS platform for managing motorcycle spare parts inventory, sales, purchase orders, and returns.

## 🎯 Features

### Admin Dashboard
- 📊 Complete inventory management with search
- ➕ Add new products with mandatory fields (Part Name, Model, MRP, Quantity)
- 📈 Track sales analytics
- 📦 Manage purchase orders from manufacturers
- 🔄 View all product returns
- 📊 Returns table with complete history

### Sales Counter
- 🔍 Real-time product search (fuzzy matching with smart feedback)
- 🛒 Shopping cart with discount support
- 🧾 Print receipts
- 🔄 Process returns with stock updates
- 💰 Auto-calculate totals

### Purchase Orders
- 📝 Create orders with auto-product lookup
- 📊 Track receiving status (pending/partial/received)
- 📦 Auto-update inventory when items marked received
- ➕ Add new products on-the-fly during ordering
- 💾 Persistent order history

### Smart Features
- 🔎 Fuzzy search with exact match detection
- ❌ Clear button in search bars
- 🔐 JWT authentication with role-based access
- ⚡ Real-time inventory updates via Socket.io
- 📱 Fully responsive design

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS 3 + React Router v6 + Axios + Socket.IO
- **Backend**: Node.js + Express + MongoDB + Mongoose + JWT + Socket.IO + CORS
- **Database**: MongoDB Atlas or local MongoDB
- **Deployment**: Vercel (monorepo with serverless functions)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Development Setup

```bash
# Install root dependencies
npm install

# Run both frontend and backend concurrently
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:5001

### Initial Setup

#### 1. Configure Backend
```bash
cd api
cp .env.example .env
# Edit .env with your MongoDB URI and JWT_SECRET
```

#### 2. Seed Database
```bash
npm run seed -C api
```

Default Test Users:
- **Admin**: admin@spares.local / Admin@12345
- **Sales**: sales@spares.local / Sales@12345

#### 3. Import Products from CSV
```bash
CSV_PATH=/path/to/your/products.csv npm run import:csv -C api
```

CSV format: `Part Name | Part Code | Model | Booking Price | MRP | Min Order Qty`

## 📁 Project Structure

```
bike-spare-saas/
├── api/                           # Node.js Express backend
│   ├── src/
│   │   ├── models/               # MongoDB schemas
│   │   ├── routes/               # API endpoints
│   │   ├── middleware/           # Auth, CORS, logging
│   │   ├── utils/                # DB, seeds, imports
│   │   └── server.js             # Express app setup
│   ├── index.js                  # Vercel serverless entry
│   ├── package.json
│   └── .env                      # Environment variables
│
├── frontend/                      # React + Vite app
│   ├── src/
│   │   ├── pages/                # Main pages (Admin, Sales, PurchaseOrders)
│   │   ├── components/           # Reusable components
│   │   ├── context/              # React Context (Auth)
│   │   ├── api/                  # API client (axios)
│   │   ├── styles/               # Tailwind CSS
│   │   └── main.jsx              # Entry & routing
│   ├── package.json
│   ├── .env                      # Dev environment
│   └── .env.production           # Production environment
│
├── package.json                  # Root workspace config
├── vercel.json                   # Vercel deployment config
├── DEPLOY_VERCEL.md              # Vercel deployment guide
└── README.md                     # This file
```

## 🔧 Available Scripts

### Root Level
```bash
npm run dev      # Run frontend + backend concurrently
npm run build    # Build both projects for production
npm start        # Start backend only (production)
```

### Frontend Only
```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Only
```bash
cd api
npm run dev      # Start with nodemon (hot reload)
npm start        # Start in production
npm run seed     # Seed test users to database
npm run import:csv  # Import products from CSV
```

## 🌐 API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer {token}` header.

### Auth
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT
- `GET /auth/me` - Get current user

### Products
- `GET /products` - List all products with search/filter
- `GET /products/:id` - Get product details
- `POST /products` - Create product (admin only)
- `PUT /products/:id` - Update product (admin only)

### Sales
- `POST /sales` - Create sale/receipt
- `GET /sales` - Get sales history

### Returns
- `GET /returns` - List all returns (admin only)
- `POST /returns` - Process return

### Purchase Orders
- `GET /purchase-orders` - List orders
- `POST /purchase-orders` - Create order (admin only)
- `GET /purchase-orders/:id` - Get order details
- `PUT /purchase-orders/:id/receive` - Mark items received
- `PUT /purchase-orders/:id` - Update order
- `DELETE /purchase-orders/:id` - Delete order

## 📦 Deployment

### Deploy to Vercel

See [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) for complete deployment guide.

**Quick Summary:**
1. Push to GitHub: `git push origin main`
2. Connect repo to Vercel dashboard
3. Set environment variables (MONGO_URI, JWT_SECRET)
4. Deploy! Frontend automatically deploys to `/`, API to `/api`

### Environment Variables for Deployment

```env
# Backend
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db_name
JWT_SECRET=your_secret_key_here
CLIENT_URL=https://your-project.vercel.app
NODE_ENV=production

# Frontend (auto-set by Vercel)
VITE_API_URL=/api
VITE_SOCKET_URL=(empty - uses current domain)
```

## 🔐 Authentication

- JWT tokens stored in localStorage
- Auto-refresh on page load
- Role-based access control:
  - **Admin**: Full access (inventory, orders, returns)
  - **Sales**: Limited access (product search, billing, returns)
- Protected routes redirect to login

## 📱 Responsive Design

- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (320px - 767px)

Built with Tailwind CSS responsive utilities.

## 🐛 Troubleshooting

### "Can't connect to MongoDB"
- Verify MONGO_URI in `.env`
- Check MongoDB Atlas IP whitelist (add 0.0.0.0 for Vercel)

### "API not responding"
- Check backend is running: `curl http://localhost:5001/health`
- Verify CORS origin in `api/.env`

### "Frontend shows 404"
- Clear browser cache
- Verify frontend is built: `npm run build -C frontend`

### "Search not working"
- Verify products exist in MongoDB
- Check browser console for API errors

## 📝 License

Private project - All rights reserved

## 👤 Support

For issues or feature requests, create an issue on GitHub.


## Important
This starter is meant for your authorized internal inventory/sales use. Keep dealer portal cookies/tokens private and do not commit `.env` files.
