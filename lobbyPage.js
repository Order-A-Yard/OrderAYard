const gameId = localStorage.getItem('gameId');
const playerId = localStorage.getItem('playerId');  // Fixed: was 'playerID', hostGame.js stores as 'playerId'
const playerName = localStorage.getItem('playerName');
const playerColor = localStorage.getItem('playerColor');
const isHost = localStorage.getItem('isHost') === 'true';

// API Configuration
const API_BASE = 'https://corsproxy.io/?http://trinity-developments.co.uk';

document.getElementById('gameCodeDisplay').textContent = gameId || 'No Game ID';

// Generate QR Code for joining the game
function generateQRCode() {
    const qrImage = document.getElementById('qrCodeImage');
    if (!qrImage) return;
    
    // Build the join URL - works for both local dev and GitHub Pages
    const baseUrl = window.location.origin;
    const pathPrefix = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const joinUrl = `${baseUrl}${pathPrefix}/joinGame.html?code=${gameId}`;
    
    // Use QR Server API (free, no signup required)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`;
    
    qrImage.src = qrApiUrl;
    qrImage.alt = `Scan to join game ${gameId}`;
    
    console.log('QR Code URL:', joinUrl);
}

// Generate QR code when page loads
generateQRCode();

        // Game state
        let players = [
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false }
        ];
        
        let currentPlayerIndex = -1; // Will be set when we find our player
        let isCurrentPlayerReady = false;

        // Initialize the current player from localStorage temporarily until server data loads
        if (playerName && playerColor) {
            // Show current player in first slot temporarily
            players[0] = { name: playerName, color: playerColor, ready: false };
            currentPlayerIndex = 0;
            updatePlayersDisplay();
            
            // Then load all players from server
            loadPlayersFromServer();
        }

        // Initialize with some demo players
        // function initializeDemoPlayers() {
        //     players[0] = { name: "Player 1", color: "#FF0000", ready: false };
        //     players[1] = { name: "Player 2", color: "#0000FF", ready: false };
        //     updatePlayersDisplay();
        // }

        function updatePlayersDisplay() {
            const rows = document.querySelectorAll('.player-row');
            console.log('updatePlayersDisplay called, found', rows.length, 'rows');
            console.log('Players to display:', JSON.stringify(players));
            
            rows.forEach((row, index) => {
                const player = players[index];
                const nameCell = row.querySelector('.player-name');
                const colorCell = row.querySelector('.color-indicator');
                const readyCell = row.querySelector('.player-ready');
                
                console.log(`Row ${index}: player =`, player, 'nameCell =', nameCell);
                
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
        const button = document.getElementById('readyButton');
            
            // Check if all players are ready
            if (areAllPlayersReady()) {
                startGame();
                return;
            }
            
            // Toggle current player's ready status
            isCurrentPlayerReady = !isCurrentPlayerReady;
            players[currentPlayerIndex].ready = isCurrentPlayerReady;
            
            
            updatePlayersDisplay();
        }

        function areAllPlayersReady() {
            // Check if at least 2 players and all active players are ready
            const activePlayers = players.filter(p => p.name !== null);
            if (activePlayers.length < 2) return false;
            
            return activePlayers.every(p => p.ready);
        }

        function updateReadyButton() {
            const button = document.getElementById('readyButton');
            
            if (areAllPlayersReady()) {
                button.textContent = 'Start Game';
                button.classList.add('start-game');
            } else {
                button.textContent = isCurrentPlayerReady ? 'Not Ready' : 'Ready';
                button.classList.remove('start-game');
            }
        }

        function startGame() {
            alert('Starting game with ' + players.filter(p => p.name !== null).length + ' players!');
            // Add your game start logic here
        }

        // Demo: Simulate other players joining and getting ready
        // function simulatePlayerJoin() {
        //     const emptySlot = players.findIndex(p => p.name === null);
        //     if (emptySlot !== -1) {
        //         const colors = ['#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
        //         players[emptySlot] = {
        //             name: `Player ${emptySlot + 1}`,
        //             color: colors[Math.floor(Math.random() * colors.length)],
        //             ready: false
        //         };
        //         updatePlayersDisplay();
        //     }
        // }

        // function simulatePlayerReady() {
        //     const unreadyPlayer = players.find(p => p.name !== null && !p.ready && players.indexOf(p) !== currentPlayerIndex);
        //     if (unreadyPlayer) {
        //         unreadyPlayer.ready = true;
        //         updatePlayersDisplay();
        //     }
        // }

        // Initialize on page load - fetch players from server
        let pollingInterval = null;
        
        function loadPlayersFromServer() { 
            if (!gameId) {
                console.error('No gameId found');
                return;
            }
            
            fetch(`${API_BASE}/games/${gameId}/players`) 
            .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log('Server returned players:', data); // Debug log
                
                // Reset players array
                players = [ 
                    { name: null, color: null, ready: false },
                    { name: null, color: null, ready: false }, 
                    { name: null, color: null, ready: false }, 
                    { name: null, color: null, ready: false }, 
                    { name: null, color: null, ready: false }, 
                    { name: null, color: null, ready: false } 
                ];

                // Populate with server data
                data.forEach((p, i) => { 
                    console.log(`Player ${i}:`, p); // Debug log each player
                    if (i < 6) { 
                        players[i].name = p.playerName || p.name;
                        players[i].color = p.color || '#808080'; // Default to gray if no color
                        players[i].ready = p.ready || false;
                        
                        // Find current player's index by matching playerId
                        if (p.playerId === playerId || p.playerName === playerName) {
                            currentPlayerIndex = i;
                            isCurrentPlayerReady = p.ready || false;
                            // Ensure our color is shown (use local color for current player only)
                            if (playerColor) {
                                players[i].color = playerColor;
                            }
                        }
                    } 
                });
                
                console.log('Final players array:', players); // Debug log

                updatePlayersDisplay();
        
                // Start polling if not already started
                if (!pollingInterval) {
                    pollingInterval = setInterval(loadPlayersFromServer, 2000);
                }
            })
            .catch(error => {
                console.error('Error loading players:', error);
            });
        }
    function play() { window.location.href = "/gamePage.html"; }
    

document.getElementById('startButton').addEventListener("click", function(){
    fetch(`${API_BASE}/games/${gameId}/start/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log("Server response:", data);
        localStorage.setItem('playerName', data.playerName);
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('gameId', gameId);
        window.location.href = '/gamePage.html';
    })
})

function checkGameState() {
    fetch(`${API_BASE}/games/${gameId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
    .then(response => response.json())
    .then(data => {
        console.log('Game state:', data.state);
        
        // When server says game has started, redirect everyone
        if (data.state === 'Fugitive') {
            localStorage.setItem('gameId', gameId);
            localStorage.setItem('playerId', playerId);
            window.location.href = '/gamePage.html';
        }
    })
    .catch(error => console.error('Failed to check game state:', error));
}

// Poll every 3 seconds for all players
setInterval(checkGameState, 3000);
