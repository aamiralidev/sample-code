import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.dependencies.models import Base

# Load the .env file
load_dotenv()

# Accessing variables
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_host = os.getenv("DB_HOST")
db_port = os.getenv("DB_PORT")

# Synchronous connection string
SQLALCHEMY_PostgreSQL_DATABASE_URL = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_user}"

# Create a regular synchronous engine
engine = create_engine(SQLALCHEMY_PostgreSQL_DATABASE_URL, echo=True)

# SessionMaker for synchronous operation
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False
)


# Function to initialize DB (sync)
def init_db():
    with engine.begin() as conn:
        Base.metadata.create_all(conn)

# Function to close DB connection (sync)
def close_db_connection():
    engine.dispose()

# Dependency (sync)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
