const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Armazenar salas ativas
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    // Criar ou entrar em uma sala
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        // Verificar quantos usuários estão na sala
        const room = io.sockets.adapter.rooms.get(roomId);
        const numClients = room ? room.size : 0;
        
        console.log(`Usuário ${userId} entrou na sala ${roomId}. Total: ${numClients}`);
        
        // Notificar outros usuários na sala
        socket.to(roomId).emit('user-connected', userId);
        
        // Se for o segundo usuário, iniciar a chamada
        if (numClients === 2) {
            io.to(roomId).emit('ready-to-call');
        }
    });

    // Sinalização WebRTC
    socket.on('offer', (data) => {
        console.log(`Offer recebido de ${data.userId} para ${data.targetUserId}`);
        socket.to(data.targetUserId).emit('offer', {
            offer: data.offer,
            userId: data.userId
        });
    });

    socket.on('answer', (data) => {
        console.log(`Answer recebido de ${data.userId} para ${data.targetUserId}`);
        socket.to(data.targetUserId).emit('answer', {
            answer: data.answer,
            userId: data.userId
        });
    });

    socket.on('ice-candidate', (data) => {
        console.log(`ICE candidate recebido de ${data.userId}`);
        socket.to(data.targetUserId).emit('ice-candidate', {
            candidate: data.candidate,
            userId: data.userId
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuário desconectado:', socket.id);
        // Notificar salas sobre desconexão
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) {
                socket.to(room).emit('user-disconnected', socket.id);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});