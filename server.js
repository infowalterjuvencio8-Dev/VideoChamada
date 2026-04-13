const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Armazenar salas e usuários
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Usuário conectado:', socket.id);

    // Criar ou entrar em uma sala
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        // Armazenar informações da sala
        if (!rooms.has(roomId)) {
            rooms.set(roomId, []);
        }
        
        const roomUsers = rooms.get(roomId);
        
        // Verificar se o usuário já está na sala
        if (!roomUsers.includes(userId)) {
            roomUsers.push(userId);
        }
        
        console.log(`📌 Usuário ${userId} entrou na sala ${roomId}`);
        console.log(`👥 Usuários na sala ${roomId}:`, roomUsers);
        
        // Notificar outros usuários que um novo usuário entrou
        socket.to(roomId).emit('user-connected', userId);
        
        // Enviar para o novo usuário a lista de usuários existentes
        const otherUsers = roomUsers.filter(id => id !== userId);
        if (otherUsers.length > 0) {
            socket.emit('existing-users', otherUsers);
        }
    });

    // Iniciar chamada (offer)
    socket.on('offer', ({ offer, to, from }) => {
        console.log(`📞 Offer de ${from} para ${to}`);
        io.to(to).emit('offer', {
            offer: offer,
            from: from
        });
    });

    // Responder chamada (answer)
    socket.on('answer', ({ answer, to, from }) => {
        console.log(`📞 Answer de ${from} para ${to}`);
        io.to(to).emit('answer', {
            answer: answer,
            from: from
        });
    });

    // ICE Candidate
    socket.on('ice-candidate', ({ candidate, to, from }) => {
        console.log(`❄️ ICE candidate de ${from} para ${to}`);
        io.to(to).emit('ice-candidate', {
            candidate: candidate,
            from: from
        });
    });

    // Desconectar
    socket.on('disconnect', () => {
        console.log('🔴 Usuário desconectado:', socket.id);
        
        // Remover usuário de todas as salas
        rooms.forEach((users, roomId) => {
            const index = users.indexOf(socket.id);
            if (index !== -1) {
                users.splice(index, 1);
                io.to(roomId).emit('user-disconnected', socket.id);
                console.log(`👋 Usuário ${socket.id} saiu da sala ${roomId}`);
                
                // Se a sala ficou vazia, remover
                if (users.length === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});