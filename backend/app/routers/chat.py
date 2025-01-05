import json
import logging
import os
import re
import requests
import psycopg2
from fastapi import APIRouter, Form, Request, WebSocket, WebSocketDisconnect, Body, HTTPException, File, UploadFile
from fastapi.responses import PlainTextResponse
from twilio.twiml.messaging_response import MessagingResponse

from app.dependencies.utils import create_chat_completion
from app.internal.prompt import Initial_prompt
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from twilio.rest import Client
from dotenv import load_dotenv, find_dotenv
from ..dependencies.deps import db_dependency, user_dependency
from twilio.twiml.voice_response import VoiceResponse, Dial
from starlette.responses import Response

from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from fastapi.staticfiles import StaticFiles
from fastapi import Request
from fastapi.responses import FileResponse
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
from mimetypes import guess_extension


load_dotenv(find_dotenv())

class MediaItem(BaseModel):
    type: str  # e.g., "image", "video"
    url: str   # Media file URL

class SendMessage(BaseModel):
    contact_number: str
    message: Optional[str]  # Message content
    media: Optional[List[MediaItem]]  # List of media items
    
class GptAnswer(BaseModel):
    allow_gpt: bool
    
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, phone_number: str, messages: List[dict], websocket: WebSocket):
        message_payload = {
            "contact_number": phone_number,
            "messages": messages
        }
        await websocket.send_json(message_payload)

    async def broadcast(self, phone_number: str, response_dict: dict):
        message_payload = {
            "phone_number": phone_number,
            "response_dict": response_dict
        }
        for connection in self.active_connections:
            await connection.send_json(message_payload)

    async def broadcast_gpt(self, is_gpt_allowed: bool):
        message_payload = {
            "is_gpt_allowed": is_gpt_allowed,
        }
        for connection in self.active_connections:
            await connection.send_json(message_payload)

manager = ConnectionManager()
router = APIRouter()
is_gpt_allowed = None

DB_NAME = os.getenv("DB_USER")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

account_sid = os.getenv("ACCOUNT_SID")
auth_token = os.getenv("ACCOUNT_TOKEN")
phone_number = os.getenv("ACCOUNT_PH")
SERVER_DOMAIN = os.getenv("SERVER_DOMAIN")

IDENTITY = {"identity": "dandependable"}

phone_pattern = re.compile(r"^[\d\+\-\(\) ]+$")

def connect_to_db():
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
    )
    cur = conn.cursor()
    return conn, cur

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logging.error(f"WebSocket Error: {e}")
        await websocket.close()

# @router.post("/voice", response_class=PlainTextResponse)
# async def voice(request: Request):
#     form_data = await request.form()
#     response = VoiceResponse()

#     if "RecordingSid" not in form_data:
#         response.say("Hello, please leave your message after the tone.")
#         response.record(transcribe=True, transcribe_callback="/transcription")
#     else:
#         response.hangup()

#     return str(response)


router.mount("/media", StaticFiles(directory="media"), name="media")

@router.get("/token")
async def generate_twilio_token(identity: str):
    """
    Generate an access token for Twilio Voice SDK.
    """
    try:
        # Your Twilio credentials
        account_sid = ""
        auth_token = ""
        api_key = ""
        api_secret = ""
        voice_service_sid = ""

        # IDENTITY["identity"] = identity
        
        # Generate the access token
        token = AccessToken(account_sid, api_key, api_secret, identity=IDENTITY["identity"])
        voice_grant = VoiceGrant(
            outgoing_application_sid=voice_service_sid,
            incoming_allow=True
        )
        token.add_grant(voice_grant)
        print(token)
        print("Identity = ", IDENTITY["identity"])
        return {"token": token.to_jwt()}
    except Exception as e:
        logging.error(f"Error generating token: {e}")
        raise HTTPException(status_code=500, detail="Error generating token")


@router.post("/handle_dial_status")
async def handle_dial_status(
    DialCallStatus: str = Form(...),
):
    response = VoiceResponse()

    if DialCallStatus == "completed":
        # Call was successfully completed; no voicemail
        response.hangup()
    else:
        # Call was not answered (e.g., no-answer, busy, failed)
        response.say("Hello, please leave your message after the tone.")
        response.record(transcribe=True, transcribe_callback="/transcription")

    return Response(content=str(response), media_type="application/xml")

@router.post("/voice")
async def handle_voice_call(request: Request):
    """
    Handle incoming and outgoing calls via TwiML.
    """
    try:
        form_data = await request.form()
        to_number = form_data.get("To", None)
        resp = VoiceResponse()

        if to_number == phone_number:
        # Receiving an incoming call to our Twilio number
        
            
            form_data = await request.form()
            response = VoiceResponse()
            print(form_data)
            # if "RecordingSid" not in form_data:
            #     print("Here")
            #     response.say("Hello, please leave your message after the tone.")
            #     response.record(transcribe=True, transcribe_callback="/transcription")
            # else:
            #     response.hangup()

            # print("WE HERE")
            # return Response(content=str(response), media_type="application/xml")

            dial = Dial(timeout=20, record="record-from-answer", action="/handle_dial_status")
            # Route to the most recently created client based on the identity stored in the session
            dial.client(IDENTITY["identity"])
            response.append(dial)
            # if "RecordingSid" not in form_data:
            #     print("Here")
            #     response.say("Hello, please leave your message after the tone.")
            #     response.record(transcribe=True, transcribe_callback="/transcription")
            # else:
            #     response.hangup()

            print("WE HERE")
            return Response(content=str(response), media_type="application/xml")
            
            ## WITHOUT VOICE MAIL
            # print(form_data)
            # dial = Dial()
            # # Route to the most recently created client based on the identity stored in the session
            # print("Identity = ", IDENTITY["identity"])
            # dial.client(IDENTITY["identity"])
            # resp.append(dial)
            
            # return Response(str(resp), mimetypes="text/xml")
        
        elif to_number:
            # Placing an outbound call from the Twilio client
            dial = Dial(caller_id=phone_number)
            # wrap the phone number or client name in the appropriate TwiML verb
            # by checking if the number given has only digits and format symbols
            if phone_pattern.match(to_number):
                dial.number(to_number)
            else:
                dial.client(to_number)
            resp.append(dial)
        else:
            resp.say("Thanks for calling!")

        print('done')
        print(str(resp))
        return Response(str(resp), media_type="text/xml")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error handling voice call: {e}")


@router.post("/transcription", response_class=PlainTextResponse)
async def transcription(request: Request):
    form_data = await request.form()
    transcription_text = form_data.get("TranscriptionText")
    from_number = form_data.get("From")

    if not transcription_text or not from_number:
        return {"error": "Invalid transcription or phone number"}

    conn, cur = connect_to_db()
    try:
        cur.execute(
            "SELECT messages FROM conversation_entries WHERE phone_number = %s",
            (from_number,),
        )
        result = cur.fetchone()

        user_message_data = {
            "role": "user",
            "content": transcription_text,
            "read": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if result:
            conversation_messages = result[0]
            conversation_messages.append(user_message_data)
            cur.execute(
                "UPDATE conversation_entries SET messages = %s WHERE phone_number = %s",
                (json.dumps(conversation_messages), from_number),
            )
        else:
            initial_prompt = Initial_prompt()
            conversation_messages = initial_prompt + [user_message_data]
            cur.execute(
                "INSERT INTO conversation_entries (phone_number, messages) VALUES (%s, %s)",
                (from_number, json.dumps(conversation_messages)),
            )

        conn.commit()
        await manager.broadcast(from_number, user_message_data)

        # Call AI/GPT service for response
        message_content, response_dict = await create_chat_completion(
            conversation_messages
        )

        if message_content == "Exception":
            return PlainTextResponse("Request Failed", media_type="application/xml")

        response_dict["read"] = False
        response_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        conversation_messages.append(response_dict)
        cur.execute(
            "UPDATE conversation_entries SET messages = %s WHERE phone_number = %s",
            (json.dumps(conversation_messages), from_number),
        )
        conn.commit()

        await manager.broadcast(from_number, response_dict)

        # Send response via Twilio
        
        try:
            client = Client(account_sid, auth_token)
            client.messages.create(
                to=from_number,
                from_=phone_number,
                body=response_dict["content"],
            )
        except Exception as e:
            logging.error(f"Twilio Error: {e}")
            raise HTTPException(status_code=500, detail="An error occurred with Twilio")

        return {"Success": "Message Sent Successfully"}

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {e}")
        return {"error": "An error occurred while processing the transcription"}

    finally:
        cur.close()
        conn.close()
        
        
DOWNLOAD_DIRECTORY = "media"  # Base directory to save media files

from mimetypes import guess_extension

@router.post("/recieve/sms")
async def incoming_sms(
    request: Request,
    Body: str = Form(None),
    From: str = Form(None),
    NumMedia: str = Form(None),
    MediaUrl0: str = Form(None),
    MessageSid: str = Form(None)
):
    from_number = From
    message = Body
    if not from_number:
        return {"error": "Invalid request"}

    conn, cur = connect_to_db()
    try:
        # Handle media messages
        media_file_path = None
        if NumMedia and int(NumMedia) > 0:
            # Create a folder for the sender if it doesn't exist
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
            folder_path = os.path.join(DOWNLOAD_DIRECTORY, from_number)
            os.makedirs(folder_path, exist_ok=True)

            try:
                # Fetch the media file from the URL
                response = requests.get(MediaUrl0, auth=(account_sid, auth_token))
                response.raise_for_status()

                # Determine the file extension from the Content-Type header
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
                file_extension = guess_extension(content_type) or '.bin'  # Default to .bin if extension can't be determined

                # Create a unique filename
                media_filename = f"{timestamp}_{MessageSid}{file_extension}"
                media_file_path = os.path.join(folder_path, media_filename)

                # Save the media content to the file
                with open(media_file_path, 'wb') as f:
                    f.write(response.content)
                print(f"Media saved successfully: {media_file_path}")
            except Exception as e:
                logging.error(f"Failed to save media: {e}")
                return {"error": "Failed to process media"}

        # Fetch existing messages or create a new conversation
        cur.execute("SELECT messages FROM conversation_entries WHERE phone_number = %s", (from_number,))
        result = cur.fetchone()

        user_message_data = {
            "role": "user",
            "content": message if message else "Media message received",  # Indicate media message if no text
            "read": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "media_path": media_file_path  # Store media file path if applicable
        }
        if result:
            conversation_messages = result[0]
            conversation_messages.append(user_message_data)
            cur.execute("UPDATE conversation_entries SET messages = %s WHERE phone_number = %s", (json.dumps(conversation_messages), from_number))
        else:
            initial_prompt = Initial_prompt()
            conversation_messages = initial_prompt + [user_message_data]
            cur.execute("INSERT INTO conversation_entries (phone_number, messages) VALUES (%s, %s)", (from_number, json.dumps(conversation_messages)))

        conn.commit()
        await manager.broadcast(from_number, user_message_data)

        if is_gpt_allowed and (not NumMedia or int(NumMedia) <= 0):
            
            message_content, response_dict = await create_chat_completion(conversation_messages)
            if message_content == "Exception":
                return PlainTextResponse("Request Failed", media_type="application/xml")

            response_dict["read"] = False
            response_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
            conversation_messages.append(response_dict)
            cur.execute("UPDATE conversation_entries SET messages = %s WHERE phone_number = %s", (json.dumps(conversation_messages), from_number))
            conn.commit()

            await manager.broadcast(from_number, response_dict)

            client = Client(account_sid, auth_token)
            try:
                client.api.account.messages.create(
                    to=from_number,
                    from_=phone_number,
                    body=response_dict["content"]
                )
            except Exception as e:
                logging.error(f"Twilio Error: {e}")
                raise HTTPException(status_code=500, detail="An error occurred with Twilio")

            return {"Success": "Message Sent Successfully"}
        
        return PlainTextResponse("Message sent successfully", media_type="application/xml")

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {e}")
        return {"error": "An error occurred while processing the message"}

    finally:
        cur.close()
        conn.close()
        
        

@router.get("/media/{path:path}")
async def custom_static_files(path: str, request: Request):
    try:
        full_path = os.path.join(DOWNLOAD_DIRECTORY, path)
        if not os.path.exists(full_path):
            logging.error(f"File not found: {full_path}")
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(full_path)
    except Exception as e:
        logging.error(f"Error serving file: {e}")
        raise HTTPException(status_code=500, detail="Error serving file")
    
# @router.post("/send-assistant-message")
# async def send_assistant_message(request: SendMessage, user: user_dependency):
#     contact_number = request.contact_number
#     message = request.message

#     if not message or not contact_number:
#         return {"error": "Invalid request"}

#     conn, cur = connect_to_db()
#     try:
#         cur.execute("SELECT messages FROM conversation_entries WHERE phone_number = %s", (contact_number,))
#         result = cur.fetchone()

#         assistant_message_data = {"role": "assistant", "content": message, "read": True, "timestamp": datetime.now(timezone.utc).isoformat()}
        
#         if result:
#             conversation_messages = result[0]
#             conversation_messages.append(assistant_message_data)
#             cur.execute("UPDATE conversation_entries SET messages = %s WHERE phone_number = %s", (json.dumps(conversation_messages), contact_number))
#         else:
#             return {"error": "The contact number is incorrect"}

#         conn.commit()
#         await manager.broadcast(contact_number, assistant_message_data)

#         client = Client(account_sid, auth_token)
#         try:
#             client.api.account.messages.create(
#                 to=contact_number,
#                 from_=phone_number,
#                 body=message)
#         except Exception as e:
#             logging.error(f"Twilio Error: {e}")
#             raise HTTPException(status_code=500, detail="An error occurred with Twilio")

#         return {"Success": "Message Sent Successfully"}

#     except Exception as e:
#         conn.rollback()
#         logging.error(f"Error: {e}")
#         raise HTTPException(status_code=500, detail="An error occurred while retrieving the messages")

#     finally:
#         cur.close()
#         conn.close()

@router.post("/send-assistant-message")
async def send_assistant_message(
    contact_number: str = Form(...),
    message: Optional[str] = Form(None),
    media: Optional[UploadFile] = File(None),
):
    if not message and not media:
        return {"error": "Invalid request: message or media is required."}

    conn, cur = connect_to_db()
    try:
        # Handle media upload
        media_file_path = None
        if media:
            # Create a folder for the sender if it doesn't exist
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
            folder_path = os.path.join(DOWNLOAD_DIRECTORY, contact_number)
            os.makedirs(folder_path, exist_ok=True)

            try:
                # Determine the file extension from the Content-Type header
                content_type = media.content_type
                file_extension = guess_extension(content_type) or '.bin'  # Default to .bin if extension can't be determined

                # Create a unique filename
                media_filename = f"{timestamp}_{uuid.uuid4()}{file_extension}"
                media_file_path = os.path.join(folder_path, media_filename)

                # Save the media content to the file
                with open(media_file_path, 'wb') as f:
                    f.write(await media.read())
                print(f"Media saved successfully: {media_file_path}")
            except Exception as e:
                logging.error(f"Failed to save media: {e}")
                return {"error": "Failed to process media"}

        # Prepare the assistant message data
        assistant_message_data = {
            "role": "assistant",
            "content": message or (f"Media message" if media_file_path else ""),
            "read": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "media_path": media_file_path  # Store media file path if applicable
        }

        # Send the media (if any) via Twilio
        client = Client(account_sid, auth_token)
        twilio_message = client.api.account.messages.create(
            to=contact_number,
            from_=phone_number,
            body=message or "Media message",
            media_url=[f"{SERVER_DOMAIN}/media/{os.path.relpath(media_file_path, DOWNLOAD_DIRECTORY)}"] if media_file_path else None
        )

        # Update the database
        cur.execute("SELECT messages FROM conversation_entries WHERE phone_number = %s", (contact_number,))
        result = cur.fetchone()

        if result:
            conversation_messages = result[0]
            conversation_messages.append(assistant_message_data)
            cur.execute(
                "UPDATE conversation_entries SET messages = %s WHERE phone_number = %s",
                (json.dumps(conversation_messages), contact_number)
            )
        else:
            conversation_messages = [assistant_message_data]
            cur.execute(
                "INSERT INTO conversation_entries (phone_number, messages) VALUES (%s, %s)",
                (contact_number, json.dumps(conversation_messages))
            )

        # Commit changes
        conn.commit()

        # Broadcast the message to the manager
        await manager.broadcast(contact_number, assistant_message_data)

        return {"Success": "Message Sent Successfully"}

    except Exception as e:
        conn.rollback()
        logging.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cur.close()
        conn.close()


@router.get("/is-allowed")
async def get_messages(request: Request, user: user_dependency):
    global is_gpt_allowed
    if is_gpt_allowed is None:
        is_gpt_allowed = True
    return {"allow_gpt": is_gpt_allowed}

@router.post("/let-gpt-answer")
async def let_gpt_answer(request: GptAnswer, user: user_dependency):
    global is_gpt_allowed
    try:
        allow_gpt = request.allow_gpt
        if is_gpt_allowed is None or allow_gpt != is_gpt_allowed:
            is_gpt_allowed = allow_gpt
            await manager.broadcast_gpt(is_gpt_allowed)
        
        return {"message": "GPT setting updated successfully", "gpt_allowed": is_gpt_allowed}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


class ArchiveChat(BaseModel):
    phone_number: str
    archive: bool

@router.post("/archive-chat")
async def archive_chat(request: ArchiveChat):
    phone_number = request.phone_number
    archive = request.archive

    conn, cur = connect_to_db()
    try:
        # Check if the chat exists
        cur.execute("SELECT messages FROM conversation_entries WHERE phone_number = %s", (phone_number,))
        result = cur.fetchone()

        if not result:
            return {"error": "Chat not found"}

        # Update the archive status
        cur.execute("UPDATE conversation_entries SET is_archived = %s WHERE phone_number = %s", (archive, phone_number))
        conn.commit()

        # Send the update to WebSocket clients if needed
        await manager.broadcast(phone_number, {"is_archived": archive})

        return {"message": "Chat archive status updated successfully", "phone_number": phone_number, "is_archived": archive}

    except Exception as e:
        conn.rollback()
        logging.error(f"Error archiving/unarchiving chat: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while updating archive status")

    finally:
        cur.close()
        conn.close()