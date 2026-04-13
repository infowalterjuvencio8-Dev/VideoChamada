const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

// CONFIGURAÇÃO ESPECIAL PARA O RENDER
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Forçar ambos os transportes
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Forçar HTTPS no Render
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// Armazenar salas e usuários
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Usuário conectado:', socket.id);

    // Criar ou entrar em uma sala
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, []);
        }
        
        const roomUsers = rooms.get(roomId);
        
        if (!roomUsers.includes(userId)) {
            roomUsers.push(userId);
        }
        
        console.log(`📌 Usuário ${userId} entrou na sala ${roomId}`);
        console.log(`👥 Usuários na sala ${roomId}:`, roomUsers);
        
        socket.to(roomId).emit('user-connected', userId);
        
        const otherUsers = roomUsers.filter(id => id !== userId);
        if (otherUsers.length > 0) {
            socket.emit('existing-users', otherUsers);
        }
    });

    socket.on('offer', ({ offer, to, from }) => {
        console.log(`📞 Offer de ${from} para ${to}`);
        io.to(to).emit('offer', { offer, from });
    });

    socket.on('answer', ({ answer, to, from }) => {
        console.log(`📞 Answer de ${from} para ${to}`);
        io.to(to).emit('answer', { answer, from });
    });

    socket.on('ice-candidate', ({ candidate, to, from }) => {
        console.log(`❄️ ICE candidate de ${from} para ${to}`);
        io.to(to).emit('ice-candidate', { candidate, from });
    });

    socket.on('disconnect', () => {
        console.log('🔴 Usuário desconectado:', socket.id);
        
        rooms.forEach((users, roomId) => {
            const index = users.indexOf(socket.id);
            if (index !== -1) {
                users.splice(index, 1);
                io.to(roomId).emit('user-disconnected', socket.id);
                
                if (users.length === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📡 WebSocket pronto para conexões`);
});