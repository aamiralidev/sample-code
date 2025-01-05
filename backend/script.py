import requests
import random
import time

# Function to generate a random phone number
def generate_random_phone_number():
    return f"{random.randint(1000000000, 9999999999)}"  # Generates a random 10-digit phone number

# Function to generate a random message
def generate_random_message():
    messages = [
        "Work on the roof, address is street 5, when will you be available?",
        "Please call me back when you can.",
        "Are we still on for the meeting tomorrow?",
        "Don't forget to bring the documents!",
        "Let me know if you need help with the project."
    ]
    return random.choice(messages)

# Endpoint URL
url = 'http://localhost:9000/recieve/sms'

# Number of messages to send
num_messages = 10

for _ in range(num_messages):
    # Generate random From number and message
    from_number = generate_random_phone_number()
    body = generate_random_message()
    
    # Prepare the data payload
    data = {
        'From': from_number,
        'Body': body
    }
    
    # Send POST request to the endpoint
    response = requests.post(url, data=data)
    
    # Print the response status
    print(f"Sent message from {from_number}: '{body}' - Status Code: {response.status_code}")
    