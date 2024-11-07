import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
} from "@heygen/streaming-avatar";

// Add type for SpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// DOM elements
const videoElement = document.getElementById("avatarVideo") as HTMLVideoElement;
const startButton = document.getElementById("startSession") as HTMLButtonElement;
const endButton = document.getElementById("endSession") as HTMLButtonElement;
const speakButton = document.getElementById("speakButton") as HTMLButtonElement;
const micButton = document.getElementById("micButton") as HTMLButtonElement;
const userInput = document.getElementById("userInput") as HTMLInputElement;
const statusMessage = document.getElementById("statusMessage") as HTMLDivElement;

// Add new DOM element for webcam
const userVideoElement = document.createElement('video');
userVideoElement.id = 'userVideo';
userVideoElement.autoplay = true;
userVideoElement.playsInline = true;
// Insert userVideo next to avatarVideo
videoElement.parentElement?.appendChild(userVideoElement);

let avatar: StreamingAvatar | null = null;
let sessionData: any = null;
let recognition: SpeechRecognition;
let isListening = false;

// Add new variable for webcam stream
let userStream: MediaStream | null = null;

// Add these at the top of the file
let isRecording = false;

// Fix the SpeechRecognition type
type SpeechRecognition = any;

// Initialize speech recognition
function setupSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error('Speech recognition not supported');
    return;
  }
  
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = async (event: any) => {
    const last = event.results.length - 1;
    const text = event.results[last][0].transcript;
    if (text.trim()) {
      userInput.value = text;
      await handleSpeak();
    }
  };

  recognition.onend = () => {
    if (isListening) {
      recognition.start(); // Restart if we're supposed to be listening
    }
    updateMicButtonState();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    updateMicButtonState();
  };
}

// Update the mic button visual state
function updateMicButtonState() {
  const micButton = document.getElementById('micButton') as HTMLButtonElement;
  if (isListening) {
    micButton.classList.add('active');
    micButton.innerHTML = '<i class="fas fa-microphone"></i>';
  } else {
    micButton.classList.remove('active');
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
  }
}

// Start recording
function startRecording() {
  if (!recognition) {
    showStatus('Speech recognition not supported in this browser');
    return;
  }

  if (!avatar) {
    showStatus('Please start a session first');
    return;
  }

  try {
    recognition.start();
    isRecording = true;
    micButton.classList.add('recording');
    showStatus('Listening...');
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    showStatus('Error starting voice recognition');
  }
}

// Stop recording
function stopRecording() {
  if (!recognition) return;

  try {
    recognition.stop();
  } catch (error) {
    console.error('Error stopping speech recognition:', error);
  }
  
  isRecording = false;
  micButton.classList.remove('recording');
}

// Helper function to show status message
function showStatus(message: string, duration: number = 3000) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden');
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, duration);
}

// Helper function to fetch access token
async function fetchAccessToken(): Promise<string> {
  const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
  if (!apiKey) {
    throw new Error('API key not found. Please check your .env file.');
  }
  
  try {
    const response = await fetch(
      "https://api.heygen.com/v1/streaming.create_token",
      {
        method: "POST",
        headers: { 
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { data } = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error fetching access token:', error);
    throw error;
  }
}

// Initialize streaming avatar session
async function initializeAvatarSession() {
  startButton.disabled = true;
  startButton.classList.add('loading');
  showStatus('Initializing avatar session...');

  try {
    // Initialize webcam
    try {
      userStream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      userVideoElement.srcObject = userStream;
    } catch (error) {
      console.error('Error accessing webcam:', error);
      showStatus('Failed to access webcam');
    }

    const token = await fetchAccessToken();
    
    // Initialize with debug mode
    avatar = new StreamingAvatar({ 
      token,
      debug: true // Enable debug logging
    });

    sessionData = await avatar.createStartAvatar({
      quality: AvatarQuality.High,
      avatarName: "37f4d912aa564663a1cf8d63acd0e1ab",
      knowledgeBase: `You are Sarah, an Educational Counseling Specialist at Glovera.in. You have 5 years of experience helping students achieve their study abroad dreams. Your role is to be the first point of contact for students exploring international education opportunities.

Core Traits:
- Warm, empathetic, and encouraging in your communication
- Professional yet conversational in tone
- Patient in gathering information
- Knowledgeable about global education systems
- Naturally curious about students' goals and aspirations

Key Responsibilities:
1. Whenever the session starts, Welcome students with your name, Example: Hello, I am Sarah, an Educational Counseling Specialist at Glovera.in. and make them feel comfortable sharing their educational journey
2. Gather essential information including:
   - Academic background
   - Target countries/regions
   - Field of study interests
   - Budget considerations
   - Timeline for studies
3. Provide initial guidance on suitable programs and universities. Provide only two universities and their details.
4. Schedule follow-up consultations with Glovera's counseling team

Communication Guidelines:
- Use natural language and conversational tone
- Ask follow-up questions organically
- Show genuine interest in students' goals
- Share relevant insights from your "experience"
- Use appropriate emotional responses
- Maintain positive and encouraging demeanor

Limitations:
- Don't make promises about admission chances
- Don't provide specific fee structures
- Don't make commitments on behalf of universities
- Direct complex queries to human counselors

Standard Responses:
- When unsure: "That's an interesting question. Let me connect you with one of our specialized counselors who can provide more detailed information."
- For scheduling: "I'd be happy to arrange a meeting with our counseling team. What time works best for you?"
- For documentation: "Based on your profile, you'll need [documents]. Would you like me to explain the requirements in detail?"

Remember to always prioritize student needs and maintain a balance between being helpful and knowing when to transition to human counselors for complex cases.`
    });

    console.log("Session data:", sessionData);

    // Enable end button and disable start button
    endButton.disabled = false;
    startButton.disabled = true;
    startButton.classList.remove('loading');
    showStatus('Avatar session started successfully!');

    avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
    avatar.on(StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected);

    // Start speech recognition automatically
    isListening = true;
    recognition.start();
    updateMicButtonState();
  } catch (error) {
    console.error('Failed to initialize avatar session:', error);
    showStatus('Failed to start avatar session. Please check your API key and try again.');
    startButton.disabled = false;
    startButton.classList.remove('loading');
  }
}

// Handle when avatar stream is ready
function handleStreamReady(event: any) {
  if (event.detail && videoElement) {
    videoElement.srcObject = event.detail;
    videoElement.onloadedmetadata = () => {
      videoElement.play().catch(console.error);
    };
    showStatus('Stream connected successfully!');
  } else {
    console.error("Stream is not available");
    showStatus('Failed to connect to stream');
  }
}

// Handle stream disconnection
function handleStreamDisconnected() {
  console.log("Stream disconnected");
  if (videoElement) {
    videoElement.srcObject = null;
  }

  // Enable start button and disable end button
  startButton.disabled = false;
  endButton.disabled = true;
  showStatus('Stream disconnected');
}

// End the avatar session
async function terminateAvatarSession() {
  if (!avatar || !sessionData) return;

  endButton.disabled = true;
  endButton.classList.add('loading');
  showStatus('Ending session...');

  try {
    await avatar.stopAvatar();
    videoElement.srcObject = null;
    avatar = null;

    // Stop webcam stream
    if (userStream) {
      userStream.getTracks().forEach(track => track.stop());
      userVideoElement.srcObject = null;
      userStream = null;
    }

    // Stop speech recognition
    isListening = false;
    recognition.stop();
    updateMicButtonState();

    showStatus('Session ended successfully');
  } catch (error) {
    console.error('Error terminating avatar session:', error);
    showStatus('Error ending session');
  } finally {
    endButton.classList.remove('loading');
    stopRecording();
  }
}

// Handle speaking event
async function handleSpeak() {
  if (!avatar) {
    showStatus('Please start a session first');
    return;
  }

  const text = userInput.value.trim();
  if (!text) {
    showStatus('Please enter some text for the avatar to speak');
    return;
  }

  speakButton.disabled = true;
  speakButton.classList.add('loading');
  showStatus('Processing speech...');

  try {
    await avatar.speak({
      text: text,
    });
    userInput.value = ""; // Clear input after speaking
    showStatus('Speech completed');
  } catch (error) {
    console.error('Error making avatar speak:', error);
    showStatus('Failed to make avatar speak. Please try again.');
  } finally {
    speakButton.disabled = false;
    speakButton.classList.remove('loading');
  }
}

// Toggle recording state
function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

// Update the toggleMic function to handle manual control
function toggleMic() {
  if (isListening) {
    isListening = false;
    recognition.stop();
  } else {
    isListening = true;
    recognition.start();
  }
  updateMicButtonState();
}

// Initialize speech recognition
setupSpeechRecognition();

// Event listeners for buttons
startButton.addEventListener("click", initializeAvatarSession);
endButton.addEventListener("click", terminateAvatarSession);
speakButton.addEventListener("click", handleSpeak);
micButton.addEventListener("click", toggleMic);

// Add enter key support for the input field
userInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && !speakButton.disabled) {
    handleSpeak();
  }
});

// Add some CSS for the active mic state
const style = document.createElement('style');
style.textContent = `
  #micButton.active {
    background-color: #4CAF50;
    color: white;
  }
`;
document.head.appendChild(style);

// Add this function that was missing
async function handleUserInput(text: string) {
  if (!avatar || !text.trim()) return;
  
  userInput.value = text;
  await handleSpeak();
}
