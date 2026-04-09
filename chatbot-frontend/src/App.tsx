import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import { Send, Upload, FileText, Trash2, MessageSquare, Bot, User, Loader2, Plus } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

interface Document {
  id: string
  filename: string
  size: number
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/documents`)
      if (res.ok) {
        const docs = await res.json()
        setDocuments(docs)
      }
    } catch {
      console.error('Failed to fetch documents')
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json()
          alert(`Failed to upload ${file.name}: ${err.detail}`)
        }
      } catch {
        alert(`Failed to upload ${file.name}`)
      }
    }
    await fetchDocuments()
    setIsUploading(false)
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`${API_URL}/documents/${docId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchDocuments()
      }
    } catch {
      console.error('Failed to delete document')
    }
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${err.detail}` },
        ])
      } else {
        const data = await res.json()
        setConversationId(data.conversation_id)
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            sources: data.sources,
          },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: Failed to connect to the server.' },
      ])
    }

    setIsLoading(false)
  }, [input, isLoading, conversationId])

  const handleNewConversation = () => {
    setMessages([])
    setConversationId(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = '44px'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-6 h-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-800">DocChat</h1>
          </div>
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Documents section */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Documents
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Upload document"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-3 p-2 bg-blue-50 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </div>
          )}

          {documents.length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Drop PDF or TXT files here, or click to upload
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 group transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(doc.size)}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 rounded-lg transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Add more files
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Chat with your documents</h2>
            <p className="text-xs text-gray-500">
              {documents.length > 0
                ? `${documents.length} document${documents.length > 1 ? 's' : ''} loaded`
                : 'Upload documents to get started'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Welcome to DocChat
              </h3>
              <p className="text-gray-500 max-w-md text-sm">
                Upload your documents (PDF or TXT) and ask questions about them.
                The chatbot will answer based strictly on your uploaded content.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-xl rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">Sources:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-md text-xs text-gray-500"
                            >
                              <FileText className="w-3 h-3" />
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={
                  documents.length > 0
                    ? 'Ask a question about your documents...'
                    : 'Upload documents first to start chatting...'
                }
                disabled={documents.length === 0}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 placeholder-gray-400 py-1.5 min-h-[28px] max-h-[120px]"
                style={{ height: '28px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || documents.length === 0}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Answers are based strictly on your uploaded documents
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
