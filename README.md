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

### Step 4: Set Up Database Schema (Knowledge Base)

1. Go to Supabase → SQL Editor
2. Create a new query and paste the SQL below. This creates the `knowledge_documents` table and policies used by this app.

```sql
-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS knowledge_submissions CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;

-- Create knowledge documents table
CREATE TABLE knowledge_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    document_url TEXT,
    author_email TEXT NOT NULL,
    author_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    category TEXT,
    tags TEXT[],
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES profiles(id)
);

-- Create indexes for better search performance
CREATE INDEX idx_knowledge_status ON knowledge_documents(status);
CREATE INDEX idx_knowledge_created ON knowledge_documents(created_at DESC);
CREATE INDEX idx_knowledge_title ON knowledge_documents(title);
CREATE INDEX idx_knowledge_search ON knowledge_documents USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- Enable Row Level Security
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view approved documents
CREATE POLICY "Anyone can view approved documents" ON knowledge_documents
    FOR SELECT USING (status = 'approved');

-- Authenticated users can submit documents
CREATE POLICY "Authenticated users can submit documents" ON knowledge_documents
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can view all documents
CREATE POLICY "Admins can view all documents" ON knowledge_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update documents
CREATE POLICY "Admins can update documents" ON knowledge_documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can delete documents
CREATE POLICY "Admins can delete documents" ON knowledge_documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create a function to search documents
CREATE OR REPLACE FUNCTION search_knowledge_documents(search_query TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    document_url TEXT,
    author_email TEXT,
    author_name TEXT,
    category TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kd.id,
        kd.title,
        kd.content,
        kd.document_url,
        kd.author_email,
        kd.author_name,
        kd.category,
        kd.tags,
        kd.created_at,
        ts_rank(to_tsvector('english', kd.title || ' ' || COALESCE(kd.content, '')), 
                plainto_tsquery('english', search_query)) as relevance
    FROM knowledge_documents kd
    WHERE kd.status = 'approved'
        AND (
            search_query = '' OR
            to_tsvector('english', kd.title || ' ' || COALESCE(kd.content, '')) @@ 
            plainto_tsquery('english', search_query)
        )
    ORDER BY relevance DESC, kd.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(doc_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE knowledge_documents 
    SET view_count = view_count + 1
    WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql;
```

3. Click "Run" to execute.
4. Ensure you have a `profiles` table with at least `id` and `role` columns. If you’re using Supabase Auth, a common pattern is to mirror new users into `profiles` and default their `role` to `member`.

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
# Required
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
USE_MOCKS=false
FRONTEND_ORIGIN=http://localhost:3000

# Optional
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-id.supabase.co:5432/postgres
OPENAI_API_KEY=sk-your-openai-key-here
PERPLEXITY_API_KEY=pplx-your-perplexity-key-here
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

# Start server (loads backend/.env automatically)
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
