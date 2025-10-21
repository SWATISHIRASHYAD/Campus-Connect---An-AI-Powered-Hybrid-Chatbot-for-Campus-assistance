from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import google.generativeai as genai
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

# ================================
# STEP 1: Config
# ================================
# os.environ["PINECONE_API_KEY"] = ""
os.environ["PINECONE_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""

try:
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index("college-bot")  # ✅ your new index
    print("✅ Pinecone client ready")
except Exception as e:
    print(f"❌ Error initializing Pinecone: {e}")

# Gemini
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("models/gemini-2.5-flash")
    print("✅ Gemini ready")
except Exception as e:
    print(f"❌ Error initializing Gemini: {e}")

# Embedder
try:
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Embedder ready")
except Exception as e:
    print(f"❌ Error loading embedder: {e}")

# FastAPI app
app = FastAPI()

# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================
# STEP 2: Models
# ================================
class Query(BaseModel):
    message: str

# ================================
# STEP 3: Helpers
# ================================
def search_pinecone(query: str, top_k: int = 5):
    try:
        vector = embedder.encode([query])[0].tolist()
        result = index.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True
        )
        if "matches" not in result or len(result["matches"]) == 0:
            return []
        return [m["metadata"].get("text", "") for m in result["matches"] if m["metadata"].get("text")]
    except Exception as e:
        print(f"❌ Pinecone query error: {e}")
        return []

def preprocess_query(query: str):
    fixes = {"dettails": "details", "facalty": "faculty"}
    for wrong, right in fixes.items():
        query = query.replace(wrong, right)
    return query.strip()

def combine_context(context_list):
    try:
        unique_context = list(dict.fromkeys(context_list))
        return "\n".join(unique_context)[:2000]
    except:
        return ""

# ================================
# STEP 4: Routes
# ================================
@app.post("/chat")
def chat(q: Query):
    query = preprocess_query(q.message)
    context_list = search_pinecone(query, top_k=5)
    combined_context = combine_context(context_list)

    if combined_context:
        prompt = f"""
        You are CampusBot, a friendly assistant for BLDEA College.
        Use the context below ONLY if it directly answers the question.
        Context:
        {combined_context}
        Question: {query}
        Answer:
        """
    else:
        prompt = f"""
        You are CampusBot, a friendly assistant for BLDEA College.
        Question: {query}
        Answer naturally and helpfully using general knowledge.
        """

    try:
        response = model.generate_content(
            contents=[{"parts": [{"text": prompt}]}],
            request_options={"timeout": 60}
        )
        if response.candidates:
            return {"answer": response.candidates[0].content.parts[0].text}
        return {"answer": "⚠️ Gemini returned no content."}
    except Exception as e:
        return {"answer": f"⚠️ Error: {e}"}

