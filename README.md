# **Customer Support Automation System**

This project is designed to automate customer support interactions by leveraging an AI-powered bot that responds to customer queries, voicemails, and missed calls. The system seamlessly integrates human agents and the AI bot to ensure customer queries are addressed efficiently. When the bot is turned off, customer calls are routed to a human agent.

## **Features**
- **AI-Powered Bot**: Automatically replies to customer queries, voicemails, and missed calls.
- **Human Agent Support**: Routes customer calls to human agents when the bot is disabled.
- **Seamless Interaction**: Ensures smooth switching between bot and human agents based on the system configuration.
- **Scalable Architecture**: Built with a Next.js frontend and a FastAPI backend for performance and flexibility.

---

## **Project Structure**
The project is organized into two main folders:

- **`frontend/`**: The Next.js application is responsible for the user interface.
- **`backend/`**: The FastAPI application is responsible for handling the logic and APIs.

---

## **Technologies Used**
### **Frontend**
- **Framework**: [Next.js](https://nextjs.org/)  
- **Languages**: JavaScript/TypeScript  
- **Styling**: Tailwind CSS

### **Backend**
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)  
- **Language**: Python  
- **Database**: PostgreSQL
- **Authentication**: JWT-based
- **AI Integration**: Pre-trained models for NLP

---

## **Setup Instructions**

### **1. Clone the Repository**
```bash
git clone <repository-url>
cd <repository-folder>
```

### **2. Backend Setup**
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate   # For macOS/Linux
   venv\Scripts\activate      # For Windows
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables in `.env`:
   - Example:
     ```
     DATABASE_URL=postgresql://<user>:<password>@localhost/<database_name>
     JWT_SECRET_KEY=your_secret_key
     AI_API_KEY=your_ai_service_key
     ```
5. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

### **3. Frontend Setup**
1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env.local`:
   - Example:
     ```
     NEXT_PUBLIC_API_URL=http://localhost:8000
     ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## **Usage**
1. Access the application via the frontend:
   - Development: `http://localhost:3000`
2. The backend API can be accessed at:
   - Development: `http://localhost:8000/`
3. Use the admin interface to create, modify, and delete users/agents:
4. Customers can interact with the system via:
   - **Calls**: Route to agents or the bot based on the bot's status.
   - **Voicemails**: The bot analyzes and responds automatically.
   - **Missed Calls**: The bot sends an automated follow-up message.
