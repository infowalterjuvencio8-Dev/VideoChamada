const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        
        if (!rooms[roomId].includes(socket.id)) {
            rooms[roomId].push(socket.id);
        }
        
        console.log(`📌 ${userId} entrou na sala ${roomId}. Total: ${rooms[roomId].length}`);
        
        // Se for o primeiro usuário, apenas aguarda
        if (rooms[roomId].length === 1) {
            socket.emit('waiting');
        } 
        // Se for o segundo, avisa ambos
        else if (rooms[roomId].length === 2) {
            const users = rooms[roomId];
            io.to(roomId).emit('both-connected', { users });
        }
        
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('signal', (data) => {
        // data = { to, from, type, signal }
        console.log(`🔄 Signal ${data.type} de ${data.from} para ${data.to}`);
        io.to(data.to).emit('signal', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        
        for (const roomId in rooms) {
            const index = rooms[roomId].indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].splice(index, 1);
                socket.to(roomId).emit('user-left', socket.id);
                
                if (rooms[roomId].length === 0) {
                    delete rooms[roomId];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});