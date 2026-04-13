'use strict';

// Elementos DOM
const joinScreen = document.getElementById('join-screen');
const callScreen = document.getElementById('call-screen');
const joinBtn = document.getElementById('join-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const roomInput = document.getElementById('room-id');
const userNameInput = document.getElementById('user-name');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteLabel = document.getElementById('remote-label');
const toggleAudioBtn = document.getElementById('toggle-audio');
const toggleVideoBtn = document.getElementById('toggle-video');
const endCallBtn = document.getElementById('end-call');
const connectionStatus = document.getElementById('connection-status');

// Variáveis globais
let socket;
let localStream;
let remoteStream;
let peerConnection;
let currentRoom = null;
let currentUser = null;
let remoteUserId = null;
let isAudioEnabled = true;
let isVideoEnabled = true;

// Configuração do WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Gerar ID único
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

// Criar nova sala
function createNewRoom() {
    const roomId = generateId();
    roomInput.value = roomId;
    connectionStatus.textContent = `Sala criada: ${roomId}`;
    return roomId;
}

// Iniciar chamada
async function startCall(roomId, userName) {
    try {
        // Conectar ao servidor
        socket = io();
        
        // Configurar eventos do socket
        setupSocketEvents();
        
        // Capturar mídia local
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        localStream = stream;
        localVideo.srcObject = stream;
        
        // Entrar na sala
        socket.emit('join-room', roomId, socket.id);
        currentRoom = roomId;
        currentUser = userName;
        
        updateConnectionStatus('Conectando à sala...');
        
    } catch (error) {
        console.error('Erro ao iniciar chamada:', error);
        alert('Erro ao acessar câmera/microfone. Verifique as permissões.');
    }
}

// Configurar eventos do socket
function setupSocketEvents() {
    socket.on('user-connected', (userId) => {
        console.log('Usuário conectado:', userId);
        if (!remoteUserId) {
            remoteUserId = userId;
            createPeerConnection();
            initiateCall();
        }
    });
    
    socket.on('ready-to-call', () => {
        updateConnectionStatus('Pronto para chamada!');
    });
    
    socket.on('offer', async (data) => {
        if (!peerConnection) {
            createPeerConnection();
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', {
            answer: answer,
            targetUserId: data.userId,
            userId: socket.id
        });
    });
    
    socket.on('answer', async (data) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });
    
    socket.on('ice-candidate', async (data) => {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
    
    socket.on('user-disconnected', (userId) => {
        if (remoteUserId === userId) {
            remoteVideo.srcObject = null;
            remoteLabel.textContent = 'Usuário desconectado';
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            updateConnectionStatus('Conexão perdida');
        }
    });
}

// Criar conexão peer
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    // Adicionar streams locais
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
    
    // Receber streams remotas
    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        remoteLabel.textContent = 'Conectado';
        updateConnectionStatus('Chamada em andamento');
    };
    
    // Enviar ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && remoteUserId) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                targetUserId: remoteUserId,
                userId: socket.id
            });
        }
    };
    
    // Monitorar conexão
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
            case 'connected':
                updateConnectionStatus('Conectado');
                break;
            case 'disconnected':
                updateConnectionStatus('Desconectado');
                break;
            case 'failed':
                updateConnectionStatus('Falha na conexão');
                break;
        }
    };
}

// Iniciar chamada (enviar offer)
async function initiateCall() {
    if (!peerConnection || !remoteUserId) return;
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('offer', {
        offer: offer,
        targetUserId: remoteUserId,
        userId: socket.id
    });
    
    updateConnectionStatus('Estabelecendo conexão...');
}

// Alternar áudio
function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioEnabled = !isAudioEnabled;
            audioTrack.enabled = isAudioEnabled;
            toggleAudioBtn.classList.toggle('active', !isAudioEnabled);
            toggleAudioBtn.textContent = isAudioEnabled ? '🎤' : '🔇';
        }
    }
}

// Alternar vídeo
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isVideoEnabled = !isVideoEnabled;
            videoTrack.enabled = isVideoEnabled;
            toggleVideoBtn.classList.toggle('active', !isVideoEnabled);
            toggleVideoBtn.textContent = isVideoEnabled ? '📹' : '📷';
        }
    }
}

// Encerrar chamada
function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    
    if (socket) {
        socket.disconnect();
    }
    
    remoteUserId = null;
    remoteLabel.textContent = 'Aguardando conexão...';
    
    // Voltar para tela inicial
    joinScreen.classList.add('active');
    callScreen.classList.remove('active');
}

// Atualizar status da conexão
function updateConnectionStatus(message) {
    connectionStatus.textContent = message;
}

// Event Listeners
joinBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    const userName = userNameInput.value.trim();
    
    if (!roomId) {
        alert('Por favor, digite um ID de sala');
        return;
    }
    
    if (!userName) {
        alert('Por favor, digite seu nome');
        return;
    }
    
    joinScreen.classList.remove('active');
    callScreen.classList.add('active');
    startCall(roomId, userName);
});

createRoomBtn.addEventListener('click', () => {
    createNewRoom();
    userNameInput.focus();
});

toggleAudioBtn.addEventListener('click', toggleAudio);
toggleVideoBtn.addEventListener('click', toggleVideo);
endCallBtn.addEventListener('click', endCall);

// Gerar ID automático quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    roomInput.value = generateId();
});