import { useState, useEffect, useRef } from "react";
import { db, auth, storage } from "./firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDocs
} from "firebase/firestore";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MessageSquare, Plus, Search, Copy, Download, Share2, Send, Paperclip, Menu, LogOut, User, Bot ,X} from "lucide-react";
import "./App.css";
import logo from './logonew1.png';

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        loadUserChats(u.uid);
      } else {
        setChats([]);
        setMessages([]);
        setCurrentChatId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load user's chat list
  const loadUserChats = (userId) => {
    const q = query(
      collection(db, "users", userId, "chats"),
      orderBy("updatedAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(chatList);
      
      // If no current chat selected and chats exist, select the first one
      if (!currentChatId && chatList.length > 0) {
        setCurrentChatId(chatList[0].id);
        loadChatMessages(userId, chatList[0].id);
      }
    });
    
    return unsubscribe;
  };

  // Load messages for a specific chat
  const loadChatMessages = (userId, chatId) => {
    const q = query(
      collection(db, "users", userId, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messageList);
    });
    
    return unsubscribe;
  };

  // Load messages when chat changes
  useEffect(() => {
    if (user && currentChatId) {
      return loadChatMessages(user.uid, currentChatId);
    }
  }, [user, currentChatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auth functions
  const handleAuth = async () => {
    try {
      setLoading(true);
      let result;
      if (authMode === "login") {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }
      setUser(result.user);
      setEmail("");
      setPassword("");
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setChats([]);
    setMessages([]);
    setCurrentChatId(null);
  };

  // Create new chat
  const createNewChat = async () => {
    if (!user) return;
    
    try {
      const newChat = {
        title: "New Chat",
        lastMessage: "",
        messageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "users", user.uid, "chats"), newChat);
      setCurrentChatId(docRef.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };

  // Select existing chat
  const selectChat = (chatId) => {
    setCurrentChatId(chatId);
    setSidebarOpen(false);
  };

  // Update chat title and last message
  const updateChatInfo = async (chatId, title, lastMessage) => {
    if (!user) return;
    
    try {
      const chatRef = doc(db, "users", user.uid, "chats", chatId);
      await updateDoc(chatRef, {
        title: title,
        lastMessage: lastMessage,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating chat:", error);
    }
  };

  // FIXED: Send message - now auto-creates chat if none exists
  const sendMessage = async () => {
    console.log("sendMessage called - Input:", input, "User:", user?.email, "Current Chat ID:", currentChatId);
    
    if (!input.trim() && !file) {
      console.log("No input or file, returning");
      return;
    }
    if (!user) {
      console.log("No user, returning");
      return;
    }

    // REMOVED: if (!currentChatId) return; 
    // Instead, create a chat if none exists
    let chatId = currentChatId;
    if (!chatId) {
      console.log("No current chat, creating new one...");
      try {
        const newChat = {
          title: input.slice(0, 30) + (input.length > 30 ? "..." : ""),
          lastMessage: input,
          messageCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, "users", user.uid, "chats"), newChat);
        chatId = docRef.id;
        setCurrentChatId(chatId);
        console.log("New chat created with ID:", chatId);
      } catch (error) {
        console.error("Error creating new chat:", error);
        alert("Error creating chat: " + error.message);
        return;
      }
    }

    let fileUrl = null;
    if (file) {
      try {
        const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(storageRef);
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }

    const userMsg = {
      sender: "user",
      text: input,
      fileUrl,
      createdAt: serverTimestamp(),
    };

    try {
      console.log("Adding user message to Firestore...");
      // Add user message to Firestore
      await addDoc(
        collection(db, "users", user.uid, "chats", chatId, "messages"),
        userMsg
      );

      // Update chat title if it's a new chat
      const currentChat = chats.find(c => c.id === chatId);
      if (!currentChat || currentChat.title === "New Chat" || !currentChat.title) {
        const title = input.slice(0, 30) + (input.length > 30 ? "..." : "");
        await updateChatInfo(chatId, title, input);
      } else {
        // Just update last message
        await updateChatInfo(chatId, currentChat?.title, input);
      }

      const currentInput = input;
      setInput("");
      setFile(null);

      console.log("Calling backend API...");
      // Backend API call
      try {
        const res = await fetch("http://127.0.0.1:8000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: currentInput }),
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Backend response:", data);

        const botMsg = {
          sender: "bot",
          text: data.answer || "No response",
          createdAt: serverTimestamp(),
        };

        // Add bot message to Firestore
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          botMsg
        );

        // Update last message to bot response
        const updatedChat = chats.find(c => c.id === chatId);
        await updateChatInfo(chatId, updatedChat?.title || "Chat", data.answer || "No response");

      } catch (err) {
        console.error("Backend error:", err);
        const errMsg = {
          sender: "bot",
          text: `⚠️ Backend error: ${err.message}`,
          createdAt: serverTimestamp(),
        };
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          errMsg
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error sending message: " + error.message);
    }
  };

  // Delete chat
  const deleteChat = async (chatId) => {
    if (!user) return;
    
    try {
      // Delete all messages in the chat
      const messagesRef = collection(db, "users", user.uid, "chats", chatId, "messages");
      const messagesSnapshot = await getDocs(messagesRef);
      
      const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Delete the chat document
      await deleteDoc(doc(db, "users", user.uid, "chats", chatId));
      
      // If this was the current chat, reset current chat
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  // Utility functions
  const copyChat = () => {
    const text = messages.map((m) => `${m.sender}: ${m.text}`).join("\n");
    navigator.clipboard.writeText(text);
    alert("✅ Chat copied!");
  };

  const downloadChat = () => {
    const currentChat = chats.find(c => c.id === currentChatId);
    const chatTitle = currentChat?.title || "chat";
    const text = messages.map((m) => `${m.sender}: ${m.text}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${chatTitle}.txt`;
    link.click();
  };

  const shareChat = async () => {
    const text = messages.map((m) => `${m.sender}: ${m.text}`).join("\n");
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      alert("Sharing not supported on this device.");
    }
  };

  // Filter chats based on search
  const filteredChats = chats.filter(chat =>
    chat.title?.toLowerCase().includes(search.toLowerCase()) ||
    chat.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            {/* Logo Section */}
            <div className="auth-logo">
              <div className="logo-icon">
              <img 
                src={logo} 
                alt="CampusBot Logo" 
                style={{
                  width: '40px', 
                  height: '40px',
                  objectFit: 'contain'
                }} 
              />
            </div>
              <h1 className="logo-title">CampusBot</h1>
              <p className="logo-subtitle">Your AI Campus Assistant</p>
            </div>

            <h2 className="auth-title">
              {authMode === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            
            <div className="auth-form">
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
              />
              <button
                onClick={handleAuth}
                disabled={loading}
                className="auth-button"
              >
                {loading ? "Processing..." : (authMode === "login" ? "Sign In" : "Create Account")}
              </button>
            </div>

            <div className="auth-switch">
              <span>{authMode === "login" ? "Don't have an account?" : "Already have an account?"}</span>
              <button
                onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                className="auth-switch-button"
              >
                {authMode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'mobile-open' : 'mobile-hidden'}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <div className="sidebar-logo">
              {/*<div className="sidebar-logo-icon">
                <Bot size={24} color="#000" />
              </div>*/}
              <div className="sidebar-logo-icon">
                <img 
                  src={logo} 
                  alt="CampusBot Logo" 
                  style={{
                    width: '60px', 
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    padding: '4px',
                    display: 'block'
                  }} 
                />
              </div>
              <h1 className="sidebar-logo-text">CampusBot</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="sidebar-close"
            >
              <X size={20} />
            </button>
          </div>
          
          <button onClick={createNewChat} className="new-chat-button">
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="search-container">
          <div className="search-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Chat History */}
        <div className="chat-history">
          <div className="chat-history-container">
            <h3 className="chat-history-title">Recent Chats</h3>
            <div className="chat-list">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={`chat-item ${currentChatId === chat.id ? 'active' : 'inactive'}`}
                >
                  <div className="chat-item-content">
                    <MessageSquare className="chat-item-icon" size={16} />
                    <div className="chat-item-text">
                      <p className="chat-item-title">
                        {chat.title || "Untitled Chat"}
                      </p>
                      <p className="chat-item-preview">
                        {chat.lastMessage || "No messages yet"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this chat?')) {
                        deleteChat(chat.id);
                      }
                    }}
                    className="chat-delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {filteredChats.length === 0 && (
                <div className="no-chats">
                  <p>No chats found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="user-profile">
          <div className="user-profile-content">
            <div className="user-info">
              <div className="user-avatar">
                <User size={16} color="#fff" />
              </div>
              <div>
                <p className="user-email">{user.email}</p>
              </div>
            </div>
            <button onClick={logout} className="logout-button" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="main-chat">
        {/* Header */}
        <header className="chat-header">
          <div className="chat-header-content">
            <div className="chat-header-left">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="menu-button"
              >
                <Menu size={24} />
              </button>
              <h2 className="chat-title">
                {currentChatId ? chats.find(c => c.id === currentChatId)?.title || 'Chat' : 'Start chatting below!'}
              </h2>
            </div>
            
            {messages.length > 0 && (
              <div className="chat-actions">
                <button onClick={copyChat} className="action-button copy" title="Copy Chat">
                  <Copy size={16} />
                </button>
                <button onClick={downloadChat} className="action-button download" title="Download Chat">
                  <Download size={16} />
                </button>
                <button onClick={shareChat} className="action-button share" title="Share Chat">
                  <Share2 size={16} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-content">
                <Bot className="empty-state-icon" size={48} />
                <h3 className="empty-state-title">
                  {chats.length === 0 ? "Welcome to CampusBot!" : "Start a conversation"}
                </h3>
                <p className="empty-state-text">
                  {chats.length === 0 
                    ? "Type a message below to start your first chat" 
                    : "Send a message to begin chatting with CampusBot"
                  }
                </p>
                {chats.length === 0 && (
                  <button onClick={createNewChat} className="start-chat-button" style={{
                    marginTop: '16px',
                    padding: '12px 24px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Create Your First Chat
                  </button>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                <div className={`message ${msg.sender}`}>
                  <div className="message-content">
                    {msg.sender === 'bot' && (
                      <Bot className="message-icon" size={16} />
                    )}
                    <div>
                      <p className="message-text">{msg.text}</p>
                      {msg.fileUrl && (
                        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="message-file">
                          <Paperclip className="message-file-icon" size={12} />
                          <span>View File</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area - FIXED */}
        <div className="input-area">
          <div className="input-container">
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={chats.length === 0 ? "Type your first message..." : "Type your message..."}
                disabled={false}  // REMOVED: !currentChatId check
                className="message-input"
              />
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="file-input"
                id="file-upload"
                disabled={false}  // REMOVED: !currentChatId check
              />
              <button
                onClick={() => document.getElementById('file-upload').click()}
                className="file-button"
                disabled={false}  // REMOVED: !currentChatId check
              >
                <Paperclip size={20} />
              </button>
              {file && (
                <div className="file-preview">
                  <span>{file.name}</span>
                  <button onClick={() => setFile(null)} className="file-remove">
                    ✕
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() && !file}  // REMOVED: || !currentChatId check
              className="send-button"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}

export default App;