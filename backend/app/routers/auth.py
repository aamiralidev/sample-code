from datetime import timedelta, datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from jose import jwt
from dotenv import load_dotenv
import os
from ..dependencies.models import User
from ..dependencies.deps import db_dependency, bcrypt_context, admin_required, user_dependency

load_dotenv()

router = APIRouter(
    prefix='/auth',
    tags=['auth']
)

SECRET_KEY = os.getenv('AUTH_SECRET_KEY')
ALGORITHM = os.getenv('AUTH_ALGORITHM')

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str  # You may include the role here, or you can set it to "user" by default

class Token(BaseModel):
    access_token: str
    token_type: str

# Function to authenticate a user by verifying the password
def authenticate_user(username: str, password: str, db):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return False
    if not bcrypt_context.verify(password, user.hashed_password):
        return False
    return user

# Function to create an access token with role included
def create_access_token(username: str, user_id: int, role: str, expires_delta: timedelta):
    encode = {'sub': username, 'id': user_id, 'role': role}
    expires = datetime.now(timezone.utc) + expires_delta
    encode.update({'exp': expires})
    return jwt.encode(encode, SECRET_KEY, algorithm=ALGORITHM)

# Route to create a new user, only accessible by admin users
@router.post("/", status_code=status.HTTP_201_CREATED)   #, dependencies=[Depends(admin_required)]
async def create_user(create_user_request: UserCreateRequest, db: db_dependency):
    # Check if the user already exists
    existing_user = db.query(User).filter(User.username == create_user_request.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    try:
        create_user_model = User(
            username=create_user_request.username,
            hashed_password=bcrypt_context.hash(create_user_request.password),
            role=create_user_request.role
        )
        db.add(create_user_model)
        db.commit()
        return {"message": "User created successfully"}
    
    except IntegrityError:
        db.rollback()  # Roll back the session to prevent partial commits
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create user due to a database integrity error"
        )

# Route to log in and generate access token
@router.post('/token', response_model=Token)
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: db_dependency):
    user = authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user')
    
    # Generate access token including the user's role
    token = create_access_token(user.username, user.id, user.role, timedelta(minutes=180))

    return {'access_token': token, 'token_type': 'bearer'}
