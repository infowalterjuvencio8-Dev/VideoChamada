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

// Armazenar informações das salas
const rooms = {};

io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);

    // Criar ou entrar em uma sala
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: [],
                userNames: {}
            };
        }
        
        // Adicionar usuário
        if (!rooms[roomId].users.includes(socket.id)) {
            rooms[roomId].users.push(socket.id);
            rooms[roomId].userNames[socket.id] = userId;
        }
        
        console.log(`📌 ${userId} (${socket.id}) entrou na sala ${roomId}`);
        console.log(`👥 Usuários na sala: ${rooms[roomId].users.length}`);
        
        // Informar quantos usuários estão na sala
        socket.emit('room-info', {
            userCount: rooms[roomId].users.length,
            users: rooms[roomId].users
        });
        
        // Avisar outros usuários que alguém entrou
        socket.to(roomId).emit('user-connected', {
            userId: socket.id,
            userName: userId
        });
        
        // Se já existem outros usuários, enviar a lista
        const otherUsers = rooms[roomId].users.filter(id => id !== socket.id);
        if (otherUsers.length > 0) {
            socket.emit('existing-users', otherUsers);
        }
    });

    // Offer (chamada)
    socket.on('offer', ({ offer, to }) => {
        console.log(`📞 Offer de ${socket.id} para ${to}`);
        io.to(to).emit('offer', {
            offer: offer,
            from: socket.id
        });
    });

    // Answer (resposta)
    socket.on('answer', ({ answer, to }) => {
        console.log(`📞 Answer de ${socket.id} para ${to}`);
        io.to(to).emit('answer', {
            answer: answer,
            from: socket.id
        });
    });

    // ICE Candidate (importante!)
    socket.on('ice-candidate', ({ candidate, to }) => {
        console.log(`❄️ ICE candidate de ${socket.id} para ${to}`);
        if (candidate) {
            io.to(to).emit('ice-candidate', {
                candidate: candidate,
                from: socket.id
            });
        }
    });

    // Desconexão
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        
        for (const roomId in rooms) {
            const index = rooms[roomId].users.indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].users.splice(index, 1);
                delete rooms[roomId].userNames[socket.id];
                
                socket.to(roomId).emit('user-disconnected', socket.id);
                console.log(`👋 Usuário ${socket.id} saiu da sala ${roomId}`);
                
                if (rooms[roomId].users.length === 0) {
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