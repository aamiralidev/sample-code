from typing import Dict, List

from pydantic import BaseModel
from sqlalchemy import JSON, Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ConversationEntryRequest(BaseModel):
    phone_number: str
    messages: List[Dict[str, str]]  # List of dicts with 'role' and 'content'


class ConversationEntry(Base):
    __tablename__ = "conversation_entries"

    entry_id = Column(Integer, primary_key=True, autoincrement=True)
    is_archived = Column(Boolean, default=False, server_default="false")  # Default value set to False
    phone_number = Column(String, index=True)
    messages = Column(JSON)  # Store messages as JSON
    

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String , unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")
