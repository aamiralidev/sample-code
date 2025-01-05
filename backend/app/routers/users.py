from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..dependencies.models import User
from ..dependencies.deps import db_dependency, bcrypt_context, admin_required

router = APIRouter(
    prefix='/users',
    tags=['users'],
    dependencies=[Depends(admin_required)]
)

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        orm_mode = True

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str

class UserUpdateRequest(BaseModel):
    username: str = None
    password: str = None
    role: str = None

# Get all users (Admin only)
@router.get("/", response_model=List[UserResponse])
async def get_users(db: db_dependency):
    users = db.query(User).all()
    return users

# Get a specific user by ID (Admin only)
@router.get("/{user_name}", response_model=UserResponse)
async def get_user(user_name: str, db: db_dependency):
    user = db.query(User).filter(User.username == user_name).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# Update a user (Admin only)
@router.put("/{user_name}", response_model=UserResponse)
async def update_user(user_name: str, user_request: UserUpdateRequest, db: db_dependency):
    user = db.query(User).filter(User.username == user_name).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Update fields only if provided
    if user_request.username:
        user.username = user_request.username
    if user_request.password:
        user.hashed_password = bcrypt_context.hash(user_request.password)
    if user_request.role:
        user.role = user_request.role

    db.commit()
    db.refresh(user)
    return user

# Delete a user (Admin only)
@router.delete("/{user_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_name: str, db: db_dependency):
    user = db.query(User).filter(User.username == user_name).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"detail": "User deleted successfully"}
