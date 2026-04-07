# 🍽️ Restaurant Management App - HTML Version

## ✅ What's New

The app has been **completely rebuilt** using static HTML files instead of React. Here's what changed:

- ✅ **Static HTML Dashboards** - Login page + 4 role-based dashboards (Owner, Manager, Waiter, Kitchen)
- ✅ **Fixed Staff Logins** - All 4 test accounts now work with password `password123`
- ✅ **Served from Backend** - Express backend now serves all HTML files directly from `/public` folder
- ✅ **One-Click Startup** - Complete startup script that initializes everything

---

## 🚀 How to Run (2 Options)

### Option 1: PowerShell (Recommended)
```powershell
# From project root directory
powershell -ExecutionPolicy Bypass -File START.ps1
```

### Option 2: Command Prompt
```cmd
cd c:\Users\topal\OneDrive\Documents\RestaurantManagment\RestaurantManagement
START.bat
```

**What it does automatically:**
1. Starts PostgreSQL
2. Initializes database with staff accounts
3. Starts Express backend (port 3000)
4. Opens browser to http://localhost:3000

---

## 👤 Test Accounts

All accounts use password: **`password123`**

| Role | Email | Dashboard |
|------|-------|-----------|
| **Owner** | owner@restaurant.com | Full analytics, all locations, revenue trends |
| **Manager** | manager@restaurant.com | Location stats, staff management, pending orders |
| **Waiter** | waiter@restaurant.com | My orders, table numbers, order status |
| **Kitchen** | kitchen@restaurant.com | Order queue, item list, mark ready |

---

## 📁 File Structure

```
RestaurantManagement/
├── backend/
│   ├── public/                 ← HTML files served here
│   │   ├── index.html          (Login page)
│   │   ├── owner.html          (Owner dashboard)
│   │   ├── manager.html        (Manager dashboard)
│   │   ├── waiter.html         (Waiter dashboard)
│   │   └── kitchen.html        (Kitchen dashboard)
│   ├── routes/
│   │   ├── auth.js             (Login/register)
│   │   ├── dashboard.js        (Analytics endpoints)
│   │   └── orders.js           (Order management)
│   ├── init-db.js              (Database setup)
│   ├── server.js               (Express server)
│   └── package.json
├── START.ps1                   (PowerShell launcher)
├── START.bat                   (Command prompt launcher)
└── README.md
```

---

## 🔐 How It Works

### 1. Login Flow
```
User visits http://localhost:3000
  ↓
Browser loads index.html (Login page)
  ↓
User enters credentials OR clicks quick-login button
  ↓
Frontend sends POST /api/auth/login
  ↓
Backend verifies password vs database
  ↓
Returns JWT token + user info
  ↓
Frontend stores token in localStorage
  ↓
Redirects to /owner.html (or manager.html, waiter.html, kitchen.html)
```

### 2. Dashboard Flow
```
Dashboard loads (e.g., owner.html)
  ↓
JavaScript fetches auth token from localStorage
  ↓
Sends GET /api/dashboard/owner-analytics with Bearer token
  ↓
Backend queries PostgreSQL for real-time data
  ↓
Returns stats, orders, locations, revenue
  ↓
JavaScript displays data in real-time
  ↓
Auto-refreshes every 10-60 seconds (per role)
```

---

## 📊 Dashboard Features

### 👑 Owner Dashboard
- 💰 Total revenue (all locations, all time)
- 📈 Revenue by location
- 📉 Daily revenue trends
- 👥 Total staff
- 📦 Total orders
- 📋 Recent orders list

### 📊 Manager Dashboard
- 💵 Today's revenue
- 📦 Total orders (location)
- ⏳ Pending orders
- 👥 Staff count
- 📋 Active orders with time

### 🍽️ Waiter Dashboard
- 📦 My orders count
- ⏳ Pending orders
- ✅ Ready for pickup
- 💰 Today's total
- 📋 Current orders table

### 👨‍🍳 Kitchen Dashboard
- ⏳ Pending queue
- 🍳 Currently cooking
- ✅ Ready for pickup
- 📊 Daily total
- 🎯 Click orders to mark ready

---

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Create new account

### Dashboard Data
- `GET /api/dashboard/owner-analytics` - Owner stats
- `GET /api/dashboard/manager-stats` - Manager stats
- `GET /api/dashboard/waiter-stats` - Waiter stats
- `GET /api/dashboard/kitchen-stats` - Kitchen stats

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status

---

## 📝 Customizing HTML

All files in `backend/public/` are standard HTML + CSS + JavaScript.

### Example: Adding a button in waiter.html
```html
<!-- Find the <button> element and add your button -->
<button class="btn" onclick="doSomething()">My Button</button>

<!-- Add JavaScript function -->
<script>
  function doSomething() {
    alert('Button clicked!');
  }
</script>
```

### Example: Changing colors
```css
.header {
    background: linear-gradient(135deg, #6bcf7f 0%, #4caf50 100%);
    /* Change hex colors #6bcf7f and #4caf50 to your colors */
}
```

---

## 🐛 Troubleshooting

### "Loading..." forever
- ✓ Check backend is running: http://localhost:3000/health
- ✓ Check browser console (F12) for errors
- ✓ Verify PostgreSQL is running
- ✓ Clear cache: Ctrl+Shift+Delete

### "Invalid credentials"
- ✓ Run `node init-db.js` in backend folder to reset users
- ✓ Use exact credentials: `owner@restaurant.com` / `password123`
- ✓ Check database connection: Run `psql -U postgres -d restaurant_db -c "SELECT COUNT(*) FROM users;"`

### Backend won't start
- ✓ Check port 3000 isn't in use: `netstat -ano | findstr :3000`
- ✓ Kill existing process: `Get-Process node | Stop-Process -Force`
- ✓ Verify dependencies: `npm install` in backend folder

### PostgreSQL issues
- ✓ Verify installed: Check `C:\Program Files\PostgreSQL\17` exists
- ✓ Manual start: `"C:\Program Files\PostgreSQL\17\bin\postgres.exe" -D "C:\Temp\postgres-data"`
- ✓ Check data: `psql -U postgres -d restaurant_db -c "\dt"`

---

## 🚀 Performance Notes

- HTML files load **instantly** (no React compilation)
- API calls cached in browser
- Auto-refresh adjustable in JavaScript
- Database queries optimized for real-time stats

---

## 📋 Known Limitations

- File uploads: Not implemented (can be added)
- Complex reports: Generate from PostgreSQL directly
- Mobile optimization: Basic responsive, not fully mobile
- Search/filtering: Not implemented in UI

---

## ✨ Future Enhancements

1. Add order creation form
2. Add real-time notifications
3. Add inventory management UI
4. Add staff scheduling
5. Add payment integration
6. Add multi-language support

---

## 📞 Support

**Files modified for this update:**
- ✅ `backend/public/` - All new HTML files
- ✅ `backend/server.js` - Added static file serving
- ✅ `backend/routes/dashboard.js` - Updated endpoints
- ✅ `backend/init-db.js` - New database setup script
- ✅ `START.ps1` / `START.bat` - New startup scripts

**Database credentials:**
- Host: `127.0.0.1`
- Port: `5432`
- Database: `restaurant_db`
- User: `postgres`

---

**Status: ✅ Complete and Ready to Deploy**

The application is now using static HTML files served from the Express backend. All staff accounts are working and the system is ready for use!
