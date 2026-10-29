"""FastAPI application entry point for Polypharm ADE."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Supports:
#   From the project root:  uvicorn backend.main:app --reload
#   From the backend folder: uvicorn main:app --reload
if __package__:
    from . import config  # Loads backend/.env before auth reads settings.
    from .auth import router as auth_router, init_auth_db
    from .clinical_analysis import router as clinical_router
    from .live_safety import router as live_safety_router
else:
    import config  # Loads .env from the backend folder.
    from auth import router as auth_router, init_auth_db
    from clinical_analysis import router as clinical_router
    from live_safety import router as live_safety_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_auth_db()
    yield


app = FastAPI(
    title="Polypharm ADE API",
    version="2.1.0",
    lifespan=lifespan,
)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",
#         "http://127.0.0.1:5173",
#     ],
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "OPTIONS"],
#     allow_headers=["Content-Type"],
# )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.23:5173",
         "https://polypharm-ade.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(clinical_router)
app.include_router(live_safety_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "polypharm-ade"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://polypharm-ade.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)