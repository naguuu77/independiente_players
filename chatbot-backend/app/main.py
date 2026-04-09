import os
import uuid
import shutil
from typing import Optional, Dict, List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from openai import OpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader

load_dotenv()

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage paths
UPLOAD_DIR = "/tmp/chatbot_uploads"
CHROMA_DIR = "/tmp/chatbot_chroma"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory document registry
documents_registry: Dict[str, dict] = {}

# Global vector store
vectorstore: Optional[Chroma] = None
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
openai_client = OpenAI()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    conversation_id: str
    sources: List[str]


# Conversation histories keyed by conversation_id
conversation_histories: Dict[str, List[Dict[str, str]]] = {}


def rebuild_vectorstore() -> Optional[Chroma]:
    """Rebuild the vector store from all uploaded documents."""
    global vectorstore

    all_docs = []
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )

    for doc_id, doc_info in documents_registry.items():
        file_path = doc_info["path"]
        if file_path.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        elif file_path.endswith(".txt"):
            loader = TextLoader(file_path, encoding="utf-8")
        else:
            continue

        raw_docs = loader.load()
        for doc in raw_docs:
            doc.metadata["source"] = doc_info["filename"]
            doc.metadata["doc_id"] = doc_id

        chunks = text_splitter.split_documents(raw_docs)
        all_docs.extend(chunks)

    if not all_docs:
        vectorstore = None
        return None

    if os.path.exists(CHROMA_DIR):
        shutil.rmtree(CHROMA_DIR)

    vectorstore = Chroma.from_documents(
        documents=all_docs,
        embedding=embeddings,
        persist_directory=CHROMA_DIR,
    )
    return vectorstore


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a PDF or TXT document for the chatbot to learn from."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("pdf", "txt"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported",
        )

    doc_id = str(uuid.uuid4())
    safe_filename = f"{doc_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    documents_registry[doc_id] = {
        "id": doc_id,
        "filename": file.filename,
        "path": file_path,
        "size": len(content),
    }

    rebuild_vectorstore()

    return {
        "id": doc_id,
        "filename": file.filename,
        "size": len(content),
        "message": f"Document '{file.filename}' uploaded and indexed successfully",
    }


@app.get("/documents")
async def list_documents():
    """List all uploaded documents."""
    return [
        {"id": info["id"], "filename": info["filename"], "size": info["size"]}
        for info in documents_registry.values()
    ]


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete an uploaded document."""
    if doc_id not in documents_registry:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_info = documents_registry.pop(doc_id)

    if os.path.exists(doc_info["path"]):
        os.remove(doc_info["path"])

    rebuild_vectorstore()

    return {"message": f"Document '{doc_info['filename']}' deleted successfully"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the bot about uploaded documents."""
    if vectorstore is None:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded yet. Please upload at least one document first.",
        )

    conversation_id = request.conversation_id or str(uuid.uuid4())

    if conversation_id not in conversation_histories:
        conversation_histories[conversation_id] = []

    history = conversation_histories[conversation_id]

    relevant_docs = vectorstore.similarity_search(request.message, k=4)
    context = "\n\n".join(doc.page_content for doc in relevant_docs)
    sources = list(set(doc.metadata.get("source", "Unknown") for doc in relevant_docs))

    system_message = (
        "You are a helpful assistant that answers questions strictly based on the provided documents. "
        "If the answer is not found in the documents, say so clearly. "
        "Do not make up information that is not in the documents.\n\n"
        f"Relevant document content:\n{context}"
    )

    messages = [{"role": "system", "content": system_message}]
    messages.extend(history)
    messages.append({"role": "user", "content": request.message})

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
    )

    answer = response.choices[0].message.content or "I could not generate a response."

    history.append({"role": "user", "content": request.message})
    history.append({"role": "assistant", "content": answer})

    if len(history) > 20:
        conversation_histories[conversation_id] = history[-20:]

    return ChatResponse(
        answer=answer,
        conversation_id=conversation_id,
        sources=sources,
    )


@app.delete("/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str):
    """Clear a conversation's history."""
    if conversation_id in conversation_histories:
        del conversation_histories[conversation_id]
    return {"message": "Conversation cleared"}
