const API_BASE = localStorage.getItem('apiBase') || 'http://trinity-developments.co.uk';

async function startGame() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    // Disable button to prevent double-click
    const startButton = document.getElementById('startButton');
    startButton.disabled = true;
    startButton.textContent = 'Creating game...';

    try {
        // Step 1: Create the game
        const gameResponse = await fetch(`${API_BASE}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `${playerName}'s Game`,
                mapId: 567,
                gameLength: 'short'
            })
        });

        if (!gameResponse.ok) {
            throw new Error(`Failed to create game: ${gameResponse.status}`);
        }

        const gameData = await gameResponse.json();
        const gameId = gameData.gameId;

        console.log('Game created:', gameData);

        // Store game info in localStorage
        localStorage.setItem('gameId', gameId);

        // Step 2: Join the game as the host player
        startButton.textContent = 'Joining game...';

        const playerResponse = await fetch(`${API_BASE}/games/${gameId}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName: playerName
            })
        });

        if (!playerResponse.ok) {
            throw new Error(`Failed to join game: ${playerResponse.status}`);
        }

        const playerData = await playerResponse.json();

        console.log('Player joined:', playerData);

        // Store player info in localStorage
        localStorage.setItem('playerId', playerData.playerId);
        localStorage.setItem('playerName', playerName);
        localStorage.removeItem('playerColor');
        localStorage.setItem('isHost', 'true');

        // Redirect to lobby
        window.location.href = `lobbyPage.html?playerId=${playerData.playerId}&gameId=${gameId}`;

    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to create game. Please try again.\n\n' + error.message);
        
        // Re-enable button
        startButton.disabled = false;
        startButton.textContent = 'Start Game';
    }
}

// Wire up the start button when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('startButton').addEventListener('click', startGame);
});
    