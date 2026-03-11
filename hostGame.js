const API_BASE = 'http://trinity-developments.co.uk';

let selectedColor = null;

function toggleColorWheel() {
    const colorWheel = document.getElementById('colorWheel');
    colorWheel.classList.toggle('active');
}

function selectColor(colorCode, colorName, element) {
    selectedColor = colorCode;
    
    // Update display
    const display = document.getElementById('selectedColorDisplay');
    display.textContent = `Selected: ${colorName}`;
    display.style.backgroundColor = colorCode;
    display.style.color = getContrastColor(colorCode);
    
    // Update selected state
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
    
    // Close color wheel
    setTimeout(() => {
        document.getElementById('colorWheel').classList.remove('active');
    }, 300); 
}

function getContrastColor(hexColor) {
    // Convert hex to RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

async function startGame() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    if (!selectedColor) {
        alert('Please select a color!');
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
                mapId: 1,
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
                playerName: playerName,
                color: selectedColor
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
        localStorage.setItem('playerColor', selectedColor);
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
    