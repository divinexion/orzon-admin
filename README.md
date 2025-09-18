# Orzon Admin - Complete Product Management System

Orzon Admin is a comprehensive, modern inventory management system designed for Orzon sellers. Built with Express.js, Handlebars, MongoDB Atlas, and Bootstrap 5, it provides a beautiful and intuitive interface for managing products, warranty registration, returns tracking, platform management, and comprehensive Excel logs.

## Features

- **Authentication**: Single admin user with email/password login
- **Product Management**: CRUD operations with detailed product and buyer information
- **Query Management**: View and manage customer queries submitted via public API
- **Search & Filters**: Search by name/serial/description, filter by type/capacity, buyer search
- **Pagination**: Efficient browsing of large product lists and queries
- **Excel Logging**: Automatic logging of all add/update operations to Excel
- **Public API**: External endpoint for submitting queries from landing pages
- **Responsive UI**: Bootstrap 5 based interface

## Prerequisites

- Node.js v18+
- MongoDB Atlas account (free tier works)
- npm or yarn

## Installation

1. **Clone and install dependencies:**
```bash
cd /opt/projects/product-inventory
npm install
```

2. **Create environment file:**
```bash
cp .env.sample .env
```

3. **Configure MongoDB Atlas:**
   - Create a MongoDB Atlas account at https://cloud.mongodb.com
   - Create a new cluster (free tier is fine)
   - Create a database user with read/write access
   - Get your connection string
   - Update `.env` with your MongoDB URI

4. **Edit `.env` file:**
```env
# Server
PORT=3100

# MongoDB Atlas - Replace with your connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/product-inventory?retryWrites=true&w=majority

# Auth - Set your admin credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password
SALT_KEY=random-salt-key-here

# Excel logging config
EXCEL_LOG_FILE=./files/products.xlsx
EXCEL_LOG_SHEET=ProductsLog

# Product config
PRODUCT_TYPE=Disk
TYPE_CAPACITIES=320,512,1024
```

5. **Initialize the admin user:**
```bash
npm run init
```

6. **Start the application:**
```bash
npm start
```

The app will be available at http://localhost:3100

## Usage

### Web Interface

1. **Login**: Navigate to http://localhost:3100 and login with your admin credentials
2. **Products**:
   - Click "Add Product" to create new entries
   - Use search bar and filters to find products
   - Click "Edit" on any product to update details
3. **Queries**:
   - View all customer queries submitted via public API
   - Search queries by name, description, or product serial
   - Mark queries as resolved/pending
   - View detailed query information
   - See related product information if serial number matches

### API Endpoints

#### Authentication APIs
```bash
# Login
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}

# Logout
POST /api/auth/logout

# Check Authentication Status
GET /api/auth/status
```

#### Public Query API (for landing pages)
```bash
POST /api/queries
Content-Type: application/json

{
  "name": "John Doe",
  "description": "I need help with disk 123",
  "productSerialNumber": "DISK-123" // optional
}
```

#### Authenticated Product APIs
```bash
# Create Product (requires authentication)
POST /api/products
Content-Type: application/json

{
  "serialNumber": "DISK-001",
  "name": "Storage Disk 320GB",
  "productType": "Disk",
  "typeCapacity": "320",
  "description": "High performance storage",
  "buyerName": "Jane Smith",
  "buyerPhone": "555-0123",
  "buyerEmail": "jane@example.com",
  "buyerAddress": "123 Main St",
  "buyerPaymentMethod": "Credit Card",
  "soldDate": "2024-01-15"
}

# Update Product (requires authentication)
PUT /api/products/:id
Content-Type: application/json
(same body as create)
```

## Data Schemas

### Product Fields:
- `serialNumber` (unique, required)
- `name` (required)
- `productType` (default: "Disk")
- `typeCapacity` (320/512/1024)
- `description`
- `addDate`
- `soldDate`

### Buyer Fields:
- `buyer.name`
- `buyer.phone`
- `buyer.email`
- `buyer.address`
- `buyer.paymentMethod`

### Query Fields:
- `name` (required) - Customer name
- `description` (required) - Query description
- `productSerialNumber` (optional) - Related product serial
- `isResolved` - Resolution status
- `resolvedAt` - Resolution timestamp
- `createdAt` - Submission timestamp

## Excel Logging

All product operations are automatically logged to an Excel file:
- Location: `./files/products.xlsx`
- Sheet name: `ProductsLog`
- Columns: Timestamp, Action, ProductId, Serial, Name, Type, Capacity, Description, Dates, Buyer info

## File Structure

```
product-inventory/
├── bin/www              # Server entry point
├── app.js               # Express app configuration
├── config/              # Configuration files
├── helpers/             # Auth and Handlebars helpers
├── models/              # Mongoose models
├── routes/              # Express routes
├── scripts/init.js      # Database initialization
├── utils/excel.js       # Excel logging utility
├── views/               # Handlebars templates
│   ├── layout/          # Layout templates
│   ├── partials/        # Reusable partials
│   ├── auth/            # Auth pages
│   ├── products/        # Product pages
│   └── queries/         # Query pages
├── public/              # Static files
├── files/               # Excel logs directory
└── logs/                # Application logs
```

## Dynamic Type Capacities

The type capacities (320, 512, 1024) are configurable via the `TYPE_CAPACITIES` environment variable. To add or modify capacities, update the `.env` file:

```env
TYPE_CAPACITIES=256,320,512,1024,2048
```

## Security Notes

- Always use strong passwords for admin account
- Keep your MongoDB connection string secure
- Use HTTPS in production
- Regularly backup your Excel logs and database

## Troubleshooting

1. **MongoDB Connection Error**: Verify your connection string and network access in Atlas
2. **Excel File Errors**: Ensure the `files/` directory exists and is writable
3. **Login Issues**: Run `npm run init` again to reset the admin user

## License

Private - For internal use only
