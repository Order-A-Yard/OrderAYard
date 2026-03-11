//creating local variables to store playernames and gamecode. will be used to add player to lobby.
let playerName
let gameCode
let selectedColour = null;

function toggleColourWheel() {
    const colourWheel = document.getElementById('colorWheel');
    colourWheel.classList.toggle('active');
}

function selectColour(colourCode, colourName) {
    selectedColour = colourCode;
    
    // Update display
    const display = document.getElementById('selectedColorDisplay');
    display.textContent = `Selected: ${colourName}`;
    display.style.backgroundColor = colourCode;
    display.style.color = getContrastColour(colourCode);
    
    // Update selected state
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    event.target.classList.add('selected');
    
    // Close colour wheel
    setTimeout(() => {
        document.getElementById('colorWheel').classList.remove('active');
    }, 300);
}

function getContrastColour(hexColour) {
    // Convert hex to RGB
    const r = parseInt(hexColour.substr(1, 2), 16);
    const g = parseInt(hexColour.substr(3, 2), 16);
    const b = parseInt(hexColour.substr(5, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function refreshColours() {
    // Reset colour selection
    selectedColour = null;
    const display = document.getElementById('selectedColorDisplay');
    display.textContent = 'No colour selected';
    display.style.backgroundColor = '#f0f0f0';
    display.style.color = '#000';
    
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    alert('Available colours refreshed! Select your colour again.');
    // Add logic here to fetch available colours from server
}

//gets data from input forms and saves them to created local variables, sends a post request to add players to game 
document.getElementById("bottom-button").addEventListener("click", function(){
    playerName = document.getElementById('playerName').value;
    gameCode = document.getElementById('gameCode').value;

    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    if (!selectedColour) {
        alert('Please select a colour!');
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

    fetch(`http://trinity-developments.co.uk/games/${gameCode}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            playerName: playerName,
            colour: selectedColour
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
        localStorage.setItem('playerColour', selectedColour);
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