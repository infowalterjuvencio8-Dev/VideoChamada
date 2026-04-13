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

// Armazenar usuários por sala
const rooms = {};

io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);

    // Usuário entra em uma sala
    socket.on('join', (roomId, userId) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        
        // Verificar se o usuário já está na sala
        if (!rooms[roomId].includes(socket.id)) {
            rooms[roomId].push(socket.id);
        }
        
        console.log(`📌 ${userId} entrou na sala ${roomId}`);
        console.log(`👥 Usuários na sala: ${rooms[roomId].length}`);
        
        // Se for o segundo usuário, avisar que pode começar
        if (rooms[roomId].length === 2) {
            io.to(roomId).emit('ready', rooms[roomId]);
        }
        
        // Avisar outros usuários na sala
        socket.to(roomId).emit('user-joined', socket.id, userId);
    });

    // Offer (chamada)
    socket.on('offer', (data) => {
        console.log(`📞 Offer de ${data.from} para ${data.to}`);
        socket.to(data.to).emit('offer', {
            sdp: data.sdp,
            from: data.from
        });
    });

    // Answer (resposta)
    socket.on('answer', (data) => {
        console.log(`📞 Answer de ${data.from} para ${data.to}`);
        socket.to(data.to).emit('answer', {
            sdp: data.sdp,
            from: data.from
        });
    });

    // ICE Candidate
    socket.on('ice-candidate', (data) => {
        console.log(`❄️ ICE de ${data.from} para ${data.to}`);
        socket.to(data.to).emit('ice-candidate', {
            candidate: data.candidate,
            from: data.from
        });
    });

    // Usuário desconectou
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        
        // Remover de todas as salas
        for (const roomId in rooms) {
            const index = rooms[roomId].indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].splice(index, 1);
                io.to(roomId).emit('user-left', socket.id);
                console.log(`👋 Usuário ${socket.id} saiu da sala ${roomId}`);
                
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
    console.log(`📡 WebSocket ativo e aguardando conexões`);
});