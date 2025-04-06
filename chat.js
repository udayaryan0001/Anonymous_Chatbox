// DOM Elements
const roomModal = document.getElementById('roomModal');
const joinPublicButton = document.getElementById('joinPublic');
const joinPrivateButton = document.getElementById('joinPrivate');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const joinChatButton = document.getElementById('joinChat');
const errorMessage = document.getElementById('errorMessage');
const chatInterface = document.getElementById('chatInterface');
const currentUsername = document.getElementById('currentUsername');
const roomTitle = document.getElementById('roomTitle');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessage');
const onlineUsers = document.getElementById('onlineUsers');
const onlineCount = document.getElementById('onlineCount');
const privateMembersSection = document.getElementById('privateMembersSection');
const privateMembers = document.getElementById('privateMembers');
const privateMembersStatus = document.getElementById('privateMembersStatus');
const publicOnlineCount = document.getElementById('publicOnlineCount');
const showCreateRoomButton = document.getElementById('showCreateRoom');
const createRoomModal = document.getElementById('createRoomModal');
const closeCreateRoomButton = document.getElementById('closeCreateRoom');
const cancelCreateRoomButton = document.getElementById('cancelCreateRoom');
const createRoomButton = document.getElementById('createRoomBtn');
const roomNameInput = document.getElementById('roomNameInput');
const memberInput = document.getElementById('memberInput');
const memberTags = document.getElementById('memberTags');
const leaveChatButton = document.getElementById('leaveChat');
const roomSearchInput = document.getElementById('roomSearch');

// State
let username = '';
let ws = null;
let currentRoom = '';
const ALLOWED_PRIVATE_USERS = ['uday', 'priyan', 'piyush', 'rahul'];
let onlineUsersList = [];
let privateRooms = new Map(); // Store private rooms: roomName -> Set of members
let selectedMembers = new Set(); // Store selected members for new private room

// Initialize WebSocket for welcome page
function initializeWelcomeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to welcome page');
        // Request initial user list and private rooms
        ws.send(JSON.stringify({
            type: 'getUsers'
        }));
        ws.send(JSON.stringify({
            type: 'getPrivateRooms'
        }));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Received welcome page message:', data);
            switch (data.type) {
                case 'userList':
                    onlineUsersList = data.users;
                    updateWelcomePageStatus(data.users);
                    break;
                case 'privateRooms':
                    updatePrivateRooms(data.rooms);
                    break;
            }
        } catch (error) {
            console.error('Error handling welcome page message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Update welcome page status
function updateWelcomePageStatus(users) {
    // Update public room count
    const publicCount = users.length;
    publicOnlineCount.innerHTML = `
        <span class="w-2 h-2 bg-green-400 rounded-full mr-2 online-dot"></span>
        <span>${publicCount} Online</span>
    `;

    // Update private members count
    const onlinePrivateMembers = ALLOWED_PRIVATE_USERS.filter(member => users.includes(member));
    privateMembersStatus.innerHTML = `
        <div class="flex items-center justify-between p-2">
            <span class="text-purple-600 font-medium">Authorized Members</span>
            <span class="inline-flex items-center text-sm">
                <span class="w-2 h-2 bg-green-400 rounded-full mr-2 online-dot"></span>
                ${onlinePrivateMembers.length} online of ${ALLOWED_PRIVATE_USERS.length}
            </span>
        </div>
    `;
}

// Private Room Management
function showCreateRoomModal() {
    createRoomModal.style.display = 'flex';
    roomModal.style.display = 'none';
    selectedMembers.clear();
    updateMemberTags();
    roomNameInput.value = '';
    memberInput.value = '';
}

function hideCreateRoomModal() {
    createRoomModal.style.display = 'none';
    roomModal.style.display = 'flex';
}

function addMember(member) {
    if (member && !selectedMembers.has(member)) {
        selectedMembers.add(member);
        updateMemberTags();
    }
    memberInput.value = '';
}

function removeMember(member) {
    selectedMembers.delete(member);
    updateMemberTags();
}

function updateMemberTags() {
    const fragment = document.createDocumentFragment();
    selectedMembers.forEach(member => {
        const tag = document.createElement('div');
        tag.className = 'member-tag';
        tag.innerHTML = `
            <span>${member}</span>
            <button onclick="removeMember('${member}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        fragment.appendChild(tag);
    });
    memberTags.innerHTML = '';
    memberTags.appendChild(fragment);
}

function createPrivateRoom() {
    const roomName = roomNameInput.value.trim();
    if (!roomName) {
        alert('Please enter a chamber name');
        return;
    }
    if (selectedMembers.size === 0) {
        alert('Please summon at least one spirit');
        return;
    }

    // Send create room request
    ws.send(JSON.stringify({
        type: 'createPrivateRoom',
        roomName: roomName,
        members: Array.from(selectedMembers)
    }));

    // Clear inputs and close modal
    roomNameInput.value = '';
    selectedMembers.clear();
    updateMemberTags();
    hideCreateRoomModal();
}

// Update private rooms display with optimized performance
function updatePrivateRooms(rooms) {
    privateRooms = new Map(Object.entries(rooms));
    
    // Get the container and template
    const container = document.querySelector('.private-rooms-container');
    const template = document.getElementById('roomCardTemplate');
    
    // Clear existing content
    container.innerHTML = '';
    
    if (Object.keys(rooms).length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'col-span-full text-center p-8';
        emptyMessage.innerHTML = `
            <i class="fas fa-ghost text-4xl text-purple-500 mb-4"></i>
            <p class="text-gray-400">No chambers have been summoned yet</p>
        `;
        container.appendChild(emptyMessage);
        return;
    }
    
    // Create room cards efficiently
    Object.entries(rooms).forEach(([roomName, members]) => {
        const roomCard = template.content.cloneNode(true);
        const card = roomCard.querySelector('.room-card');
        
        // Set room name
        card.querySelector('.room-name').textContent = roomName;
        
        // Update member count
        const onlineMembers = Array.from(members).filter(member => onlineUsersList.includes(member));
        card.querySelector('.online-count').textContent = 
            `${onlineMembers.length} online of ${members.length} members`;
        
        // Add member list
        const memberList = card.querySelector('.member-list');
        Array.from(members).forEach(member => {
            const isOnline = onlineUsersList.includes(member);
            const memberEl = document.createElement('div');
            memberEl.className = 'member-tag';
            memberEl.innerHTML = `
                <span class="online-indicator" style="background: ${isOnline ? '#10B981' : '#6B7280'}"></span>
                ${member}
            `;
            memberList.appendChild(memberEl);
        });
        
        // Add event listeners
        card.querySelector('.join-btn').onclick = () => joinPrivateRoom(roomName);
        card.querySelector('.delete-btn').onclick = () => deletePrivateRoom(roomName);
        
        container.appendChild(roomCard);
    });
}

// Function to join a private room
function joinPrivateRoom(roomName) {
    if (!privateRooms.has(roomName)) {
        alert('This room no longer exists.');
        return;
    }

    const members = privateRooms.get(roomName);
    currentRoom = roomName;
    
    // Show username modal for joining the private room
    roomModal.style.display = 'none';
    usernameModal.style.display = 'flex';
    errorMessage.style.display = 'none';
    usernameInput.value = '';
    roomTitle.textContent = `Private Room: ${roomName}`;
}

// Delete room functionality
function deletePrivateRoom(roomName) {
    if (!privateRooms.has(roomName)) {
        alert('This room no longer exists.');
        return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete the room "${roomName}"? This action cannot be undone.`);
    if (confirmDelete) {
        console.log('Sending delete room request:', roomName);
        ws.send(JSON.stringify({
            type: 'deletePrivateRoom',
            roomName: roomName
        }));
    }
}

// Event Listeners
joinPublicButton.addEventListener('click', () => showUsernameModal('public'));
joinPrivateButton.addEventListener('click', () => showUsernameModal('private'));
joinChatButton.addEventListener('click', handleJoinChat);
sendMessageButton.addEventListener('click', () => handleSendMessage());
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});
showCreateRoomButton.addEventListener('click', showCreateRoomModal);
closeCreateRoomButton.addEventListener('click', hideCreateRoomModal);
cancelCreateRoomButton.addEventListener('click', hideCreateRoomModal);
createRoomButton.addEventListener('click', createPrivateRoom);
memberInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const member = memberInput.value.trim();
        if (member) {
            addMember(member);
        }
    }
});
leaveChatButton.addEventListener('click', () => {
    if (ws) {
        ws.close();
    }
    chatInterface.style.display = 'none';
    roomModal.style.display = 'flex';
    messagesArea.innerHTML = '';
});

// Show username modal with selected room
function showUsernameModal(room) {
    currentRoom = room;
    roomModal.style.display = 'none';
    usernameModal.style.display = 'flex';
    errorMessage.style.display = 'none';
    usernameInput.value = '';
    roomTitle.textContent = room === 'public' ? 'Public Chat Room' : 'Private Chat Room';
    
    // Show/hide private members section
    privateMembersSection.style.display = room === 'private' ? 'block' : 'none';
    if (room === 'private') {
        updatePrivateMembers();
    }
}

// Update private members list
function updatePrivateMembers() {
    privateMembers.innerHTML = `
        <div class="flex items-center justify-between p-4">
            <span class="text-purple-600 font-medium">Private Members</span>
            <span class="inline-flex items-center text-sm">
                <span class="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                ${ALLOWED_PRIVATE_USERS.length} members
            </span>
        </div>
    `;
}

// Initialize WebSocket connection
function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
        ws.send(JSON.stringify({
            type: 'join',
            username: username,
            room: currentRoom
        }));
    };

    ws.onmessage = handleWebSocketMessage;
    
    ws.onclose = () => {
        addSystemMessage('Disconnected from server. Please refresh the page.');
        updateOnlineUsers([]); // Clear online users list
    };
    
    ws.onerror = () => {
        addSystemMessage('Error connecting to server. Please refresh the page.');
    };
}

// Handle joining the chat
function handleJoinChat() {
    username = usernameInput.value.trim().toLowerCase();
    
    if (!username) {
        return;
    }

    if (currentRoom === 'private' && !ALLOWED_PRIVATE_USERS.includes(username)) {
        errorMessage.style.display = 'block';
        return;
    }

    usernameModal.style.display = 'none';
    chatInterface.style.display = 'flex';
    currentUsername.textContent = username;
    initializeWebSocket();
}

// Handle sending messages
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'message',
            content: message,
            room: currentRoom
        }));
        messageInput.value = '';
        messageInput.focus();
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);
        
        switch (data.type) {
            case 'message':
                if (data.room === currentRoom) {
                    addMessage(data.username, data.content, false, data.timestamp);
                }
                break;
            case 'system':
                addSystemMessage(data.content);
                break;
            case 'userList':
                onlineUsersList = data.users;
                updateWelcomePageStatus(data.users);
                updateOnlineUsers(data.users);
                if (data.room === currentRoom) {
                    updatePrivateRooms(privateRooms);
                }
                break;
            case 'privateRooms':
                updatePrivateRooms(data.rooms);
                break;
            case 'roomCreated':
                // Handle successful room creation
                console.log('Private room created:', data.roomName);
                break;
            case 'error':
                // Handle error messages
                alert(data.message || 'An error occurred');
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        console.error('Message data:', event.data);
    }
}

// Update the online users list
function updateOnlineUsers(users) {
    onlineCount.textContent = users.length;
    onlineUsers.innerHTML = '';
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = `${user === username ? 'text-blue-600 font-semibold' : 'text-gray-700'} flex items-center animate-fade-in`;
        userElement.innerHTML = `
            <span class="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
            ${user}
            ${user === username ? ' (You)' : ''}
        `;
        onlineUsers.appendChild(userElement);
    });
}

// Add a message to the chat
function addMessage(user, text, isSystem = false, timestamp = null) {
    const messageElement = document.createElement('div');
    
    if (isSystem) {
        messageElement.className = 'text-center text-gray-500 text-sm py-2 message-animation';
        messageElement.textContent = text;
    } else {
        const isOwnMessage = user === username;
        messageElement.className = `message-bubble message-animation bg-white rounded-lg p-4 shadow mb-2 ${
            isOwnMessage ? 'ml-auto max-w-[80%] bg-gradient-to-r from-blue-50 to-blue-100' : 'mr-auto max-w-[80%]'
        }`;
        messageElement.innerHTML = `
            <div class="flex justify-between items-start gap-4">
                <span class="font-semibold ${isOwnMessage ? 'text-blue-600' : 'text-gray-800'}">${user}</span>
                <span class="text-xs text-gray-400 whitespace-nowrap">${timestamp || new Date().toLocaleTimeString()}</span>
            </div>
            <p class="mt-1 text-gray-600 break-words">${text}</p>
        `;
    }
    
    messagesArea.appendChild(messageElement);
    scrollToBottom();

    // Add hover effect for non-system messages
    if (!isSystem) {
        messageElement.addEventListener('mouseenter', () => {
            messageElement.style.transform = 'translateX(4px)';
        });
        messageElement.addEventListener('mouseleave', () => {
            messageElement.style.transform = 'translateX(0)';
        });
    }
}

// Add a system message
function addSystemMessage(text) {
    addMessage(null, text, true);
}

// Scroll to the bottom of the messages area
function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Clean up WebSocket connection when leaving
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
});

// Debounce the search function for better performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimize room search
const handleRoomSearch = debounce((searchTerm) => {
    const roomCards = document.querySelectorAll('.room-card');
    roomCards.forEach(card => {
        const roomName = card.querySelector('.room-name').textContent.toLowerCase();
        card.style.display = roomName.includes(searchTerm.toLowerCase()) ? 'block' : 'none';
    });
}, 150);

// Update event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeWelcomeWebSocket();

    // Optimize event listeners
    showCreateRoomButton?.addEventListener('click', showCreateRoomModal);
    closeCreateRoomButton?.addEventListener('click', hideCreateRoomModal);
    cancelCreateRoomButton?.addEventListener('click', hideCreateRoomModal);
    createRoomButton?.addEventListener('click', createPrivateRoom);

    // Optimize member input
    memberInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const member = memberInput.value.trim();
            if (member) {
                addMember(member);
            }
        }
    });

    // Optimize room search
    roomSearchInput?.addEventListener('input', (e) => handleRoomSearch(e.target.value));
}); 