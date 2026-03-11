const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('gameId') || localStorage.getItem('gameId');
const playerId = urlParams.get('playerId') || localStorage.getItem('playerId');

// Re-save to localStorage so gamePage.js can read them
localStorage.setItem('gameId', gameId);
localStorage.setItem('playerId', playerId);

const playerName = localStorage.getItem('playerName');
const playerColor = localStorage.getItem('playerColor');
const isHost = localStorage.getItem('isHost') === 'true';

document.getElementById('gameCodeDisplay').textContent = gameId || 'No Game ID';

// Game state
let players = [
    { name: null, color: null, ready: false },
    { name: null, color: null, ready: false },
    { name: null, color: null, ready: false },
    { name: null, color: null, ready: false },
    { name: null, color: null, ready: false },
    { name: null, color: null, ready: false }
];

let currentPlayerIndex = -1;
let isCurrentPlayerReady = false;
let pollingInterval = null;
let gameStateInterval = null;

function updatePlayersDisplay() {
    const rows = document.querySelectorAll('.player-row');
    
    rows.forEach((row, index) => {
        const player = players[index];
        const nameCell = row.querySelector('.player-name');
        const colorCell = row.querySelector('.color-indicator');
        const readyCell = row.querySelector('.player-ready');
        
        if (player.name) {
            nameCell.textContent = player.name;
            colorCell.style.backgroundColor = player.color;
            readyCell.textContent = player.ready ? '✅' : '❌';
            row.classList.add('active');
        } else {
            nameCell.textContent = 'Waiting...';
            colorCell.style.backgroundColor = 'transparent';
            readyCell.textContent = '❌';
            row.classList.remove('active');
        }
    });
    
    updateReadyButton();
}

function toggleReady() {
    if (areAllPlayersReady()) {
        return;
    }
    
    isCurrentPlayerReady = !isCurrentPlayerReady;
    players[currentPlayerIndex].ready = isCurrentPlayerReady;
    updatePlayersDisplay();
}

function areAllPlayersReady() {
    const activePlayers = players.filter(p => p.name !== null);
    if (activePlayers.length < 2) return false;
    return activePlayers.every(p => p.ready);
}

function updateReadyButton() {
    const button = document.getElementById('readyButton');
    if (!button) return;
    
    if (areAllPlayersReady()) {
        button.textContent = 'Start Game';
        button.classList.add('start-game');
    } else {
        button.textContent = isCurrentPlayerReady ? 'Not Ready' : 'Ready';
        button.classList.remove('start-game');
    }
}

function loadPlayersFromServer() { 
    if (!gameId) return;
    
    fetch(`http://trinity-developments.co.uk/games/${gameId}`)
    .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
    })
    .then(data => {
        // Check game state first — redirect if started
        const state = data.state.toLowerCase();
        if (state === 'fugitive' || state === 'detective') {
            clearInterval(pollingInterval);
            window.location.href = `/gamePage.html?playerId=${playerId}&gameId=${gameId}`;
            return;
        }

        const serverPlayers = data.players;
        
        players = [
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false } 
        ];

        serverPlayers.forEach((p, i) => { 
            if (i < 6) { 
                players[i].name = p.playerName;
                players[i].color = p.colour || '#808080';
                players[i].ready = false;
                
                if (p.playerId === parseInt(playerId)) {
                    currentPlayerIndex = i;
                }
            } 
        });

        if (isHost) {
            document.getElementById('startButton').style.display = 'block';
        }
        
        updatePlayersDisplay();
    })
    .catch(error => console.error('Error loading players:', error));
}

function checkGameState() {
    if (!gameId) return;

    fetch(`http://trinity-developments.co.uk/games/${gameId}`)
    .then(response => response.json())
    .then(data => {
        console.log('Game state:', data.state);
        
        // Redirect everyone when game starts
        if (data.state === 'fugitive' || data.state === 'detective') {
            clearInterval(pollingInterval);
            clearInterval(gameStateInterval);
            window.location.href = '/gamePage.html';
        }

        // Hide start button if lobby is no longer open
        if (data.state !== 'open') {
            document.getElementById('startButton').style.display = 'none';
        }
    })
    .catch(error => console.error('Failed to check game state:', error));
}

document.getElementById('startButton').addEventListener("click", function(){
    fetch(`http://trinity-developments.co.uk/games/${gameId}/start/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
        return response.json().then(body => {
            if (!response.ok) {
                throw new Error(body.message);
            }
            return body;
        });
    })
    .then(data => {
        console.log("Game started:", data);
        // Don't redirect here — checkGameState polling will redirect everyone
    })
    .catch(error => {
        console.error('Failed to start game:', error);
        alert('Failed to start game: ' + error.message);
    });
});

// Start polling
loadPlayersFromServer();
pollingInterval = setInterval(loadPlayersFromServer, 2000);