const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} request to ${req.url}`);
    next();
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store connected clients and their usernames for each room
const rooms = {
    public: new Map(),
    private: new Map()
};

// Store private chat rooms
const privateRooms = new Map();

// List of allowed users for the default private room
const ALLOWED_PRIVATE_USERS = ['uday', 'priyan', 'piyush', 'rahul'];

// Broadcast to specific room
function broadcastToRoom(room, message) {
    const clients = rooms[room] || new Map();
    clients.forEach((username, client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Broadcast to private room
function broadcastToPrivateRoom(roomName, message) {
    const members = privateRooms.get(roomName);
    if (!members) return;

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.username && members.has(client.username)) {
            client.send(JSON.stringify(message));
        }
    });
}

// Broadcast user list for a room
function broadcastUserList(room) {
    const clients = rooms[room] || new Map();
    const users = Array.from(clients.values());
    broadcastToRoom(room, {
        type: 'userList',
        users: users,
        room: room
    });
}

// Broadcast private rooms list
function broadcastPrivateRooms() {
    const roomsData = {};
    privateRooms.forEach((members, roomName) => {
        roomsData[roomName] = Array.from(members);
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'privateRooms',
                rooms: roomsData
            }));
        }
    });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);

            switch (data.type) {
                case 'join':
                    handleJoin(ws, data);
                    break;
                case 'message':
                    handleMessage(ws, data);
                    break;
                case 'getUsers':
                    handleGetUsers(ws);
                    break;
                case 'getPrivateRooms':
                    handleGetPrivateRooms(ws);
                    break;
                case 'createPrivateRoom':
                    handleCreatePrivateRoom(ws, data);
                    break;
                case 'deletePrivateRoom':
                    handleDeletePrivateRoom(ws, data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        handleDisconnect(ws);
    });
});

// Handle user join
function handleJoin(ws, data) {
    const { username, room } = data;
    
    if (room === 'private' && !ALLOWED_PRIVATE_USERS.includes(username)) {
        ws.send(JSON.stringify({
            type: 'error',
            content: 'Access denied to private chat room'
        }));
        return;
    }

    // Store user information
    ws.username = username;
    ws.room = room;

    // Add to room
    if (!rooms[room]) {
        rooms[room] = new Map();
    }
    rooms[room].set(ws, username);

    console.log(`User ${username} joined ${room} chat`);

    // Broadcast join message
    broadcastToRoom(room, {
        type: 'system',
        content: `${username} joined the chat`,
        room: room
    });

    // Update user list
    broadcastUserList(room);
}

// Handle chat messages
function handleMessage(ws, data) {
    if (!ws.username || !ws.room) return;

    const message = {
        type: 'message',
        content: data.content,
        username: ws.username,
        timestamp: new Date().toLocaleTimeString(),
        room: ws.room
    };

    console.log(`Message from ${ws.username} in ${ws.room}: ${data.content}`);
    broadcastToRoom(ws.room, message);
}

// Handle get users request
function handleGetUsers(ws) {
    const allUsers = new Set();
    for (const [room, clients] of Object.entries(rooms)) {
        clients.forEach(username => allUsers.add(username));
    }
    ws.send(JSON.stringify({
        type: 'userList',
        users: Array.from(allUsers)
    }));
}

// Handle get private rooms request
function handleGetPrivateRooms(ws) {
    const roomsData = {};
    privateRooms.forEach((members, roomName) => {
        roomsData[roomName] = Array.from(members);
    });
    ws.send(JSON.stringify({
        type: 'privateRooms',
        rooms: roomsData
    }));
}

// Handle create private room
function handleCreatePrivateRoom(ws, data) {
    const { roomName, members } = data;
    
    // Validate input
    if (!roomName || !members || members.length === 0) {
        ws.send(JSON.stringify({
            type: 'error',
            content: 'Invalid room data provided'
        }));
        return;
    }

    // Check if room name already exists
    if (privateRooms.has(roomName)) {
        ws.send(JSON.stringify({
            type: 'error',
            content: 'A room with this name already exists'
        }));
        return;
    }

    // Create new private room
    privateRooms.set(roomName, new Set(members));
    console.log(`Created private room: ${roomName} with members:`, members);

    // Create a new room in the rooms object for this private room
    rooms[roomName] = new Map();

    // Send success message to creator
    ws.send(JSON.stringify({
        type: 'system',
        content: `Private room "${roomName}" created successfully`
    }));

    // Broadcast updated private rooms list to all clients
    broadcastPrivateRooms();

    // Notify all online members that they've been added to a new room
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && 
            client.username && 
            members.includes(client.username)) {
            client.send(JSON.stringify({
                type: 'system',
                content: `You have been added to private room "${roomName}"`
            }));
        }
    });
}

// Handle delete private room
function handleDeletePrivateRoom(ws, data) {
    const { roomName } = data;
    console.log('Handling delete room request:', roomName);
    
    // Validate input
    if (!roomName || !privateRooms.has(roomName)) {
        ws.send(JSON.stringify({
            type: 'error',
            content: 'Invalid room name or room does not exist'
        }));
        return;
    }

    // Get members before deleting
    const members = Array.from(privateRooms.get(roomName));

    // Delete the private room
    privateRooms.delete(roomName);
    
    // Remove the room from rooms object if it exists
    if (rooms[roomName]) {
        delete rooms[roomName];
    }
    
    console.log(`Deleted private room: ${roomName}`);

    // Send success message to the user who deleted the room
    ws.send(JSON.stringify({
        type: 'system',
        content: `Private room "${roomName}" has been deleted`
    }));

    // Broadcast updated private rooms list to all clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            // Send updated private rooms list
            client.send(JSON.stringify({
                type: 'privateRooms',
                rooms: Object.fromEntries(privateRooms)
            }));

            // If client was in the deleted room, send them back to welcome page
            if (client.room === roomName) {
                client.send(JSON.stringify({
                    type: 'system',
                    content: 'The room you were in has been deleted. Returning to welcome page...'
                }));
            }
        }
    });

    // Clean up any connected clients in the deleted room
    if (rooms[roomName]) {
        rooms[roomName].forEach((username, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.room = null;
            }
        });
        delete rooms[roomName];
    }
}

// Handle user disconnect
function handleDisconnect(ws) {
    if (ws.username && ws.room) {
        console.log(`User ${ws.username} left ${ws.room} chat`);
        
        // Remove from room
        if (rooms[ws.room]) {
            rooms[ws.room].delete(ws);
            
            // Broadcast leave message
            broadcastToRoom(ws.room, {
                type: 'system',
                content: `${ws.username} left the chat`,
                room: ws.room
            });
            
            // Update user list
            broadcastUserList(ws.room);
        }
    }
}

// Start server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
}); 