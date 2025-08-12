# Rare Bridge AI

AI tools and community for rare disorders. This application provides a comprehensive platform connecting patients, caregivers, and clinicians to trustworthy knowledge and practical AI helpers.

## 🚀 Features

- **AI Tools**: Chat with documents, voice interactions, web search, one-sheet generation, and recipe suggestions
- **Knowledge Base**: Searchable trusted articles with contribution system
- **Community**: Events, Discord integration, and support groups
- **Authentication**: Secure login/signup with role-based access control
- **Brave Browser Support**: Optimized for Brave browser with wallet extension compatibility

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Authentication and database
- **Sonner** - Toast notifications

### Backend
- **FastAPI** - Python web framework
- **SQLAlchemy** - Database ORM
- **PostgreSQL** - Database
- **Redis** - Caching
- **Uvicorn** - ASGI server

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm
- Python 3.11+
- PostgreSQL (or Docker)
- Git

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd rare-bridge-ai-final

# Start database and Redis services
docker-compose up -d

# Start backend (Terminal 1)
cd backend
source .venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

### Option 2: Manual Setup

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On macOS/Linux
# OR
.venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install
# OR
pnpm install

# Start development server
npm run dev
# OR
pnpm dev
```

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔧 Environment Variables

Create `.env.local` files in both frontend and backend directories:

### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_USE_MOCKS=false
```

### Backend (.env)
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_API_KEY=your_openai_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
USE_MOCKS=false
CORS_ORIGINS=["http://localhost:3000"]
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build individual services
docker build -t rare-bridge-backend ./backend
docker build -t rare-bridge-frontend ./frontend
```

## 📁 Project Structure

```
rare-bridge-ai-final/
├── backend/
│   ├── app/
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── models.py         # Database models
│   │   └── main.py           # FastAPI app
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                  # Next.js app directory
│   ├── components/           # React components
│   ├── lib/                  # Utilities and config
│   ├── package.json
│   └── next.config.mjs
├── supabase/                 # Database migrations
├── docker-compose.yml
└── README.md
```

## 🔒 Security Features

- CORS protection
- Authentication with Supabase
- Role-based access control
- Input validation with Pydantic
- Secure headers configuration

## 🌐 Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Brave**: Full support with wallet extension compatibility

### Brave Browser Notes

The application includes special handling for Brave browser users with wallet extensions:
- Automatic detection of Brave browser and wallet extensions
- User-friendly notifications about potential navigation issues
- Fallback navigation methods to handle wallet interference
- Clear instructions for resolving issues

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm run test

# Backend tests
cd backend
pytest
```

## 📦 Build for Production

```bash
# Frontend build
cd frontend
npm run build
npm start

# Backend build
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Review the browser compatibility notes
3. Ensure all environment variables are properly set
4. Check the API documentation at http://localhost:8000/docs

## 🙏 Acknowledgments

- Built with Next.js and FastAPI
- Powered by Supabase
- Styled with Tailwind CSS
- Icons from Lucide React
