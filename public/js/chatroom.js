const socket = io();

// Get username and room from the URL
const params = new URLSearchParams(window.location.search);
const username = params.get('username');
const room = params.get('room');

// Validate that both username and room exist
if (!username || !room) {
  alert('Invalid access! Username and room are required.');
  window.location.href = '/join.html';
}

// Display the current room and username in the header
document.getElementById('username-header').textContent = username;
document.getElementById('room-name').textContent = room;
document.getElementById('room-id').textContent = `Room: ${room}`;

// Emit joinRoom event to server
socket.emit('joinRoom', { username, room });

// Display active users in the sidebar
socket.on('activeUsers', (users) => {
  const userList = document.getElementById('user-list');
  userList.innerHTML = '';  // Clear existing list

  // Loop through the active users and display their names in the list
  users.forEach((user) => {
    const li = document.createElement('li');
    li.textContent = user;
    userList.appendChild(li);
  });
});

// Receive and display messages
socket.on('message', ({ username: sender, message }) => {
  const chat = document.getElementById('chat');
  
  // Create a div for the message bubble
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  
  // Check if the message is from the current user
  if (sender === username) {
    messageDiv.classList.add('sent');  // Right side for current user
  } else {
    messageDiv.classList.add('received');  // Left side for others
  }
  
  // Add the message text
  const messageText = document.createElement('span');
  messageText.textContent = message;
  messageDiv.appendChild(messageText);
  
  // Add a timestamp
  const timestamp = document.createElement('div');
  timestamp.classList.add('timestamp');
  timestamp.textContent = new Date().toLocaleTimeString().slice(0, 5);  // Format the time
  messageDiv.appendChild(timestamp);
  
  // Append the message to the chat
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight; // Auto-scroll
});

// Send a chat message
document.getElementById('send-btn').addEventListener('click', () => {
  const message = document.getElementById('message').value.trim();
  if (message) {
    socket.emit('chatMessage', { room, username, message });
    document.getElementById('message').value = '';
  }
});

// Notify others when a user is typing
document.getElementById('message').addEventListener('input', () => {
  socket.emit('typing', { room, username });
});

socket.on('typing', (user) => {
  const chat = document.getElementById('chat');
  const typingEl = document.getElementById('typing-notification');
  if (!typingEl) {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-notification';
    typingDiv.textContent = `${user} is typing...`;
    chat.appendChild(typingDiv);
    setTimeout(() => typingDiv.remove(), 2000);
  }
});
