# DocChat - Document-based Chatbot

A fullstack web app that lets you upload documents (PDF/TXT) and chat with an AI that answers questions strictly based on your uploaded content.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python FastAPI + OpenAI API + ChromaDB (vector store) + LangChain

## Prerequisites

- Node.js 18+
- Python 3.12+
- Poetry (`pip install poetry`)
- An OpenAI API key with billing enabled (https://platform.openai.com/api-keys)

## Setup & Run

### 1. Backend

```bash
cd chatbot-backend

# Create .env file with your API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# Install dependencies
poetry install

# Start the server
poetry run fastapi dev app/main.py --port 8000
```

The backend will be available at `http://localhost:8000`.
API docs at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd chatbot-frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Usage

1. Open `http://localhost:5173` in your browser
2. Upload PDF or TXT documents using the sidebar (drag & drop or click)
3. Ask questions in the chat — the AI will answer based strictly on your documents
4. Start new conversations with the "New Conversation" button
5. Delete documents from the sidebar when no longer needed

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/healthz` | Health check |
| POST | `/upload` | Upload a PDF or TXT document |
| GET | `/documents` | List all uploaded documents |
| DELETE | `/documents/{id}` | Delete a document |
| POST | `/chat` | Send a chat message |
| DELETE | `/conversations/{id}` | Clear conversation history |

## Notes

- The chatbot uses `gpt-4o-mini` for cost-effective responses
- Documents are chunked and embedded using `text-embedding-3-small`
- Conversation history is maintained per session (in-memory)
- The AI will only answer based on uploaded documents — it won't make things up
