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

## 🔧 Supabase Setup (Required for Production)

### Step 1: Create Supabase Project

1. **Go to [supabase.com](https://supabase.com)** and sign up/login
2. **Click "New Project"**
3. **Fill in project details**:
   - Organization: Select your organization
   - Project name: `rare-bridge-ai` (or your preferred name)
   - Database password: Create a strong password (save this!)
   - Region: Choose closest to your users
4. **Click "Create new project"**
5. **Wait for setup** (takes 2-3 minutes)

### Step 2: Get Your API Keys

1. **In your Supabase dashboard**, go to **Settings** → **API**
2. **Copy these values** (you'll need them for environment variables):
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon (public) key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Service role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (keep this secret!)

### Step 3: Enable Email/Password Authentication

1. **Go to Authentication** → **Providers**
2. **Find "Email" provider** and click **Edit**
3. **Enable "Enable email confirmations"** (optional but recommended)
4. **Click "Save"**

### Step 4: Set Up Database Schema

1. **Go to SQL Editor** in your Supabase dashboard
2. **Create a new query** and paste this SQL:

```sql
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('guest', 'member', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create knowledge base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Knowledge base policies
CREATE POLICY "Anyone can view approved knowledge" ON knowledge_base
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Authenticated users can create knowledge" ON knowledge_base
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can view all knowledge" ON knowledge_base
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update knowledge status" ON knowledge_base
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'member');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

3. **Click "Run"** to execute the SQL

### Step 5: Configure Environment Variables

#### Frontend (.env.local)
Create `frontend/.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_USE_MOCKS=false
```

#### Backend (.env)
Create `backend/.env` with:
```env
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-id.supabase.co:5432/postgres
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
OPENAI_API_KEY=sk-your-openai-key-here
PERPLEXITY_API_KEY=pplx-your-perplexity-key-here
USE_MOCKS=false
CORS_ORIGINS=["http://localhost:3000"]
```

### Step 6: Get Database Connection String

1. **Go to Settings** → **Database**
2. **Find "Connection string"** section
3. **Copy the "URI"** format connection string
4. **Replace `[YOUR-PASSWORD]`** with your database password
5. **Use this as your `DATABASE_URL`** in backend `.env`

### Step 7: Get AI API Keys

#### OpenAI API Key
1. **Go to [platform.openai.com](https://platform.openai.com)**
2. **Sign up/login**
3. **Go to API Keys** section
4. **Click "Create new secret key"**
5. **Copy the key** (starts with `sk-`)

#### Perplexity API Key
1. **Go to [perplexity.ai](https://perplexity.ai)**
2. **Sign up/login**
3. **Go to Settings** → **API Keys**
4. **Create new API key**
5. **Copy the key** (starts with `pplx-`)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/Prithvicy/rare-bridge-ai-final.git
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

1. Check the [Issues](https://github.com/Prithvicy/rare-bridge-ai-final/issues) page
2. Review the browser compatibility notes
3. Ensure all environment variables are properly set
4. Check the API documentation at http://localhost:8000/docs
5. Verify Supabase setup and database connection

## 🙏 Acknowledgments

- Built with Next.js and FastAPI
- Powered by Supabase
- Styled with Tailwind CSS
- Icons from Lucide React
