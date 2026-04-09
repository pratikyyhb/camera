// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); // ✅ FIX

const app = express();
const server = http.createServer(app);

// ✅ VERY IMPORTANT (fixes your CORS error)
app.use(cors());

// Store active sessions
const activeSessions = {};

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO setup
const io = socketIo(server, {
    cors: {
        origin: "*"
    }
});

// 📡 Receive frames from sender
app.post('/api/stream', (req, res) => {
    const { sessionId, imageData, timestamp } = req.body;

    if (!sessionId || !imageData) {
        return res.status(400).json({ error: "Invalid data" });
    }

    if (!activeSessions[sessionId]) {
        activeSessions[sessionId] = {
            viewers: 0,
            lastFrame: null,
            lastUpdate: null
        };
    }

    activeSessions[sessionId].lastFrame = imageData;
    activeSessions[sessionId].lastUpdate = timestamp;

    // 🔥 Send frame to viewers
    io.to(sessionId).emit('frame', {
        imageData,
        timestamp
    });

    res.json({ viewers: activeSessions[sessionId].viewers });
});

// ❌ End session
app.post('/api/end-session', (req, res) => {
    const { sessionId } = req.body;

    if (activeSessions[sessionId]) {
        io.to(sessionId).emit('session-ended');
        delete activeSessions[sessionId];
    }

    res.json({ success: true });
});

// 👀 Viewer page
app.get('/view/:sessionId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

// 🔌 Socket connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        socket.join(sessionId);

        if (!activeSessions[sessionId]) {
            activeSessions[sessionId] = {
                viewers: 0,
                lastFrame: null
            };
        }

        activeSessions[sessionId].viewers++;

        console.log(`Viewer joined ${sessionId}`);

        // Send last frame instantly
        if (activeSessions[sessionId].lastFrame) {
            socket.emit('frame', {
                imageData: activeSessions[sessionId].lastFrame
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        for (let sessionId in activeSessions) {
            if (activeSessions[sessionId].viewers > 0) {
                activeSessions[sessionId].viewers--;
            }
        }
    });
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});