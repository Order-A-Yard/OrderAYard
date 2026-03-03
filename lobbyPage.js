const gameId = localStorage.getItem('gameId');

document.getElementById('gameCodeDisplay').textContent = gameId;

        // Game state
        let players = [
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false },
            { name: null, color: null, ready: false }
        ];
        
        let currentPlayerIndex = 0; // The current user's player index
        let isCurrentPlayerReady = false;

        // Initialize with some demo players
        // function initializeDemoPlayers() {
        //     players[0] = { name: "Player 1", color: "#FF0000", ready: false };
        //     players[1] = { name: "Player 2", color: "#0000FF", ready: false };
        //     updatePlayersDisplay();
        // }

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

        // Initialize on page load
       function loadPlayersFromServer() { 
        fetch('/api/players') 
        .then(res => res.json()) 
        .then(data => {
            players = [ { name: null, color: null, ready: false },
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false }, 
            { name: null, color: null, ready: false } 
        ];

        data.forEach((p, i) => { 
            if (i < 6) { 
                players[i].name = p.name; 
                players[i].color = p.color; 
            } 
        });

        updatePlayersDisplay();
    
        setInterval(loadPlayersFromServer, 2000);
       });
    }
    function play() { window.location.href = "/gamePage.html"; }
    