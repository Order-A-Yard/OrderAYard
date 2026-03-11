//creating local variables to store playernames and gamecode. will be used to add player to lobby.
let playerName
let gameCode

// Smart API base - uses proxy only on HTTPS (GitHub Pages), direct on localhost
const API_SERVER = 'http://trinity-developments.co.uk';
const isSecure = window.location.protocol === 'https:';
const API_BASE = isSecure ? `https://corsproxy.io/?${API_SERVER}` : API_SERVER;

// Auto-fill game code from URL if present (for QR code scanning)
function autoFillGameCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    
    if (codeFromUrl) {
        document.getElementById('gameCode').value = codeFromUrl;
        console.log('Game code auto-filled from QR code:', codeFromUrl);
    }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', autoFillGameCode);

//gets data from input forms and saves them to created local variables, sends a post request to add players to game 
document.getElementById("bottom-button").addEventListener("click", function(){
    playerName = document.getElementById('playerName').value;
    gameCode = document.getElementById('gameCode').value;

    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    if (!selectedColor) {
        alert('Please select a color!');
        return;
    }

    if (!gameCode) {
        alert('Please enter a game code!');
        return;
    }

    // Disable button to prevent double-click
    const joinButton = document.getElementById('bottom-button');
    joinButton.disabled = true;
    joinButton.textContent = 'Joining game...';

    fetch(`${API_BASE}/games/${gameCode}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            playerName: playerName,
            color: selectedColor
        })   
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log("Server response:", data);
        // Store player info in localStorage (matching hostGame.js format)
        localStorage.setItem('playerId', data.playerId);  // lowercase 'd' to match hostGame.js
        localStorage.setItem('playerName', playerName);
        localStorage.setItem('playerColor', selectedColor);
        localStorage.setItem('gameId', gameCode);
        localStorage.setItem('isHost', 'false');  // This player is not the host
        window.location.href = "/lobbyPage.html";
    })
    .catch(error => {
        console.error('Error joining game:', error);
        alert('Failed to join game. Please check the game code and try again.\n\n' + error.message);
        
        // Re-enable button
        joinButton.disabled = false;
        joinButton.textContent = 'Join Game';
    })
})