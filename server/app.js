const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./db');
const Message = require('./models/Message');
const path = require('path');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '../public')));



let usersInRooms = {};  // Object to track active users by room

io.on('connection', (socket) => {
  console.log('New WebSocket connection');

  socket.on('joinRoom', ({ username, room }) => {
    // Save the username in the room's user list
    if (!usersInRooms[room]) {
      usersInRooms[room] = [];
    }
    usersInRooms[room].push(username);

    // Join the room
    socket.join(room);

    // Broadcast to the room about the new user joining
    socket.emit('message', { username: 'System', message: `Welcome to the ${room} room, ${username}!` });
    socket.broadcast.to(room).emit('message', { username: 'System', message: `${username} has joined the chat.` });

    // Emit the updated list of active users to the room
    io.to(room).emit('activeUsers', usersInRooms[room]);

    // Handle message sending
    socket.on('chatMessage', ({ username, message }) => {
      io.to(room).emit('message', { username, message });
    });

    // Handle typing notifications
    socket.on('typing', ({ username }) => {
      socket.broadcast.to(room).emit('typing', username);
    });

    // When a user disconnects, remove them from the active users list
    socket.on('disconnect', () => {
      // Remove the user from the active users list
      usersInRooms[room] = usersInRooms[room].filter(user => user !== username);

      // Broadcast to the room that the user has left
      io.to(room).emit('message', { username: 'System', message: `${username} has left the chat.` });

      // Emit the updated list of active users to the room
      io.to(room).emit('activeUsers', usersInRooms[room]);
    });


    // ******////
    socket.on('editMessage', ({ messageId, newMessage }) => {
      if (canEditOrDelete(messageId)) {
        messages[messageId].message = newMessage;
        io.to(messages[messageId].room).emit('messageUpdated', { messageId, newMessage });
      } else {
        socket.emit('editFailed', 'You can only edit messages within 10 minutes.');
      }
    });
  
    socket.on('deleteMessage', ({ messageId, deleteForEveryone }) => {
      if (canEditOrDelete(messageId)) {
        if (deleteForEveryone) {
          io.to(messages[messageId].room).emit('messageDeleted', { messageId });
        } else {
          socket.emit('messageDeleted', { messageId });
        }
        delete messages[messageId];
      } else {
        socket.emit('deleteFailed', 'You can only delete messages within 10 minutes.');
      }
    });
  
    function canEditOrDelete(messageId) {
      const message = messages[messageId];
      const currentTime = new Date().getTime();
      return message && (currentTime - message.time) <= 10 * 60 * 1000; // 10 minutes
    }
  
    function generateUniqueId() {
      return Math.random().toString(36).substr(2, 9);
    }


  });
});

  

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


app.post('/editMessage', async (req, res) => {
  const { id, newMessage } = req.body;

  try {
      const message = await Message.findById(id);

      if (!message) {
          return res.status(404).send('Message not found');
      }

      // Check if the user can still edit the message
      if (message.canEdit && Date.now() < message.expiresAt) {
          message.message = newMessage;
          await message.save();
          io.to(message.room).emit('messageUpdated', { id, newMessage });
          return res.status(200).send('Message updated successfully');
      }

      return res.status(403).send('Edit timeframe expired');
  } catch (error) {
      return res.status(500).send('Server error');
  }
});


app.post('/deleteMessage', async (req, res) => {
  const { id } = req.body;

  try {
      const message = await Message.findById(id);

      if (!message) {
          return res.status(404).send('Message not found');
      }

      // Check if the user can still delete the message
      if (message.canEdit && Date.now() < message.expiresAt) {
          await Message.findByIdAndDelete(id);
          io.to(message.room).emit('messageDeleted', { id });
          return res.status(200).send('Message deleted successfully');
      }

      return res.status(403).send('Delete timeframe expired');
  } catch (error) {
      return res.status(500).send('Server error');
  }
});

// const users = {}; // To track users in each room

// io.on('connection', (socket) => {
//   console.log('New client connected');

//   // Handle user joining a room
//   socket.on('joinRoom', async ({ username, room }) => {
//     socket.join(room);
//     console.log(`${username} joined room: ${room}`);
//     // Add the user to the active users list
//     if (!users[room]) {
//       users[room] = [];
//     }
//     users[room].push({ id: socket.id, username });

//     // Send previous messages to the user
//     const messages = await Message.find({ room }).sort({ createdAt: -1 }).limit(50).exec();
//     socket.emit('previousMessages', messages);

//     // Broadcast to other users in the room
//     socket.broadcast.to(room).emit('message', {
//       username: 'System',
//       message: `${username} has joined the room.`,
//       time: new Date().toLocaleTimeString().slice(0, 5),
//     });

//      // Send the active users list to all clients in the room
//      io.to(room).emit('activeUsers', users[room].map(user => user.username));
//   });

//   // Handle incoming chat messages
//   socket.on('chatMessage', async ({ room, username, message, time }) => {
//     const newMessage = new Message({ room, username, message, time });
//     await newMessage.save();

//     io.to(room).emit('message', { id: newMessage._id, username, message, time });
//   });

//   // Handle message updates
//   socket.on('editMessage', async ({ id, newMessage }) => {
//     const updatedMessage = await Message.findByIdAndUpdate(id, { message: newMessage }, { new: true });
//     if (updatedMessage) {
//       io.to(updatedMessage.room).emit('messageUpdated', { id: updatedMessage._id, newMessage: updatedMessage.message });
//     }
//   });

//   // Handle message deletions
//   socket.on('deleteMessage', async ({ id }) => {
//     const deletedMessage = await Message.findByIdAndDelete(id);
//     if (deletedMessage) {
//       io.to(deletedMessage.room).emit('messageDeleted', { id: deletedMessage._id });
//     }
//   });


//   // Handle typing notifications
//   socket.on('typing', ({ username, room }) => {
//     socket.broadcast.to(room).emit('userTyping', username);
//   });

//    socket.on('typing', ({ username }) => {
//       socket.broadcast.to(room).emit('typing', username);
//     });
//   socket.on('stopTyping', ({ room }) => {
//     socket.broadcast.to(room).emit('userStoppedTyping');
//   });
 

//   socket.on('disconnect', () => {
//      // Find the user and remove from the active users list
//      for (let room in users) {
//       const userIndex = users[room].findIndex(user => user.id === socket.id);
//       if (userIndex !== -1) {
//         const username = users[room][userIndex].username;
//         users[room].splice(userIndex, 1);

//         // Notify others in the room
//         socket.broadcast.to(room).emit('message', {
//           username: 'System',
//           message: `${username} has left the room.`,
//           time: new Date().toLocaleTimeString().slice(0, 5),
//         });

//         // Send the updated active users list
//         io.to(room).emit('activeUsers', users[room].map(user => user.username));
//         break;
//       }
//     }
//     console.log('Client disconnected');
//   });
// });

// server.listen(process.env.PORT || 3000, () => {
//   console.log(`Server running on port ${process.env.PORT || 3000}`);
// });
