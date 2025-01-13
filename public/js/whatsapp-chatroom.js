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
socket.on('message', ({ username: sender, message, time }) => {
  const chat = document.getElementById('chat');

  // Create a div for the message bubble
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');

  // Check if the message is from the current user
  if (sender === username) {
      messageDiv.classList.add('sent'); // Right side for current user
  } else {
      messageDiv.classList.add('received'); // Left side for others
  }

  // Add the sender's username
  const userNameSpan = document.createElement('div');
  userNameSpan.classList.add('username');
  userNameSpan.textContent = sender; // Add sender's username
  messageDiv.appendChild(userNameSpan);

  
  // Add the message text
  const messageText = document.createElement('span');
  messageText.textContent = message;
  messageDiv.appendChild(messageText);

  // Add a timestamp
  const timestamp = document.createElement('div');
  timestamp.classList.add('timestamp');
  timestamp.textContent = time || new Date().toLocaleTimeString().slice(0, 5); // Add time
  messageDiv.appendChild(timestamp);

  // Append the message to the chat
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight; // Auto-scroll
});

// When sending a message
document.getElementById('send-btn').addEventListener('click', () => {
  const message = document.getElementById('message').value.trim();
  if (message) {
      const time = new Date().toLocaleTimeString().slice(0, 5); // Get time
      socket.emit('chatMessage', { room, username, message, time });
      document.getElementById('message').value = '';
  }
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


const themeSwitcher = document.getElementById('theme-switcher');
themeSwitcher.addEventListener('click', () => {
    const body = document.body;
    body.classList.toggle('dark');
    body.classList.toggle('light');
});

socket.on('chatMessage', ({ room, username, message, time }) => {
  const messageData = { username, message, time };
  io.to(room).emit('message', messageData); // Broadcast to all users in the room
});




function createMessageElement({ id, username: sender, message, time, canEdit }) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  messageDiv.id = `message-${id}`;

  const userNameSpan = document.createElement('div');
  userNameSpan.classList.add('username');
  userNameSpan.textContent = sender;
  messageDiv.appendChild(userNameSpan);

  const messageText = document.createElement('span');
  messageText.classList.add('text');
  messageText.textContent = message;
  messageDiv.appendChild(messageText);

  const timestamp = document.createElement('div');
  timestamp.classList.add('timestamp');
  timestamp.textContent = time;
  messageDiv.appendChild(timestamp);

  if (sender === username && canEdit) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.classList.add('edit-btn');
      editBtn.onclick = () => editMessage(id, message);
      messageDiv.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.add('delete-btn');
      deleteBtn.onclick = () => deleteMessage(id);
      messageDiv.appendChild(deleteBtn);
  }

  return messageDiv;
}
function editMessage(id, currentMessage) {
  const newMessage = prompt('Edit your message:', currentMessage);
  if (newMessage && newMessage.trim()) {
      fetch('/editMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, newMessage }),
      })
          .then((response) => {
              if (response.ok) {
                  document.querySelector(`#message-${id} .text`).textContent = newMessage;
              } else {
                  alert('Unable to edit message. Time expired.');
              }
          })
          .catch(() => alert('Error editing message.'));
  }
}
function deleteMessage(id) {
  if (confirm('Are you sure you want to delete this message?')) {
      fetch('/deleteMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
      })
          .then((response) => {
              if (response.ok) {
                  document.getElementById(`message-${id}`).remove();
              } else {
                  alert('Unable to delete message. Time expired.');
              }
          })
          .catch(() => alert('Error deleting message.'));
  }
}
socket.on('messageUpdated', ({ id, newMessage }) => {
  const messageElement = document.getElementById(`message-${id}`);
  if (messageElement) {
      messageElement.querySelector('.text').textContent = newMessage;
  }
});

socket.on('messageDeleted', ({ id }) => {
  const messageElement = document.getElementById(`message-${id}`);
  if (messageElement) {
      messageElement.remove();
  }
});



let typingTimeout;

const typingIndicator = document.getElementById('typing-indicator');

// Emit typing event when input is detected
document.getElementById('message').addEventListener('input', () => {
  clearTimeout(typingTimeout);
  socket.emit('typing', { username, room });

  // Set a timeout to emit stopTyping after a short delay
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping', { room });
  }, 1000);
});

// Display the typing notification when another user is typing
socket.on('userTyping', (typingUser) => {
  if (typingUser !== username) {
    typingIndicator.textContent = `${typingUser} is typing...`;
    typingIndicator.style.display = 'block';
  }
});

// Hide the typing notification when the user stops typing
socket.on('userStoppedTyping', () => {
  typingIndicator.style.display = 'none';
});






//***** */
function createMessageElement({ id, username: sender, message, time }) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  messageDiv.id = `message-${id}`;

  // Other message elements...

  if (sender === username) {
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editMessage(id, message);
    messageDiv.appendChild(editBtn);

    const deleteForMeBtn = document.createElement('button');
    deleteForMeBtn.textContent = 'Delete for Me';
    deleteForMeBtn.onclick = () => deleteMessage(id, false);
    messageDiv.appendChild(deleteForMeBtn);

    const deleteForEveryoneBtn = document.createElement('button');
    deleteForEveryoneBtn.textContent = 'Delete for Everyone';
    deleteForEveryoneBtn.onclick = () => deleteMessage(id, true);
    messageDiv.appendChild(deleteForEveryoneBtn);
  }

  return messageDiv;
}

function editMessage(id, currentMessage) {
  const newMessage = prompt('Edit your message:', currentMessage);
  if (newMessage) {
    socket.emit('editMessage', { messageId: id, newMessage });
  }
}

function deleteMessage(id, deleteForEveryone) {
  if (confirm('Are you sure you want to delete this message?')) {
    socket.emit('deleteMessage', { messageId: id, deleteForEveryone });
  }
}

socket.on('messageUpdated', ({ messageId, newMessage }) => {
  const messageElement = document.getElementById(`message-${messageId}`);
  if (messageElement) {
    messageElement.querySelector('.text').textContent = newMessage;
  }
});

socket.on('messageDeleted', ({ messageId }) => {
  const messageElement = document.getElementById(`message-${messageId}`);
  if (messageElement) {
    messageElement.remove();
  }
});

socket.on('editFailed', (message) => {
  alert(message);
});

socket.on('deleteFailed', (message) => {
  alert(message);
});

