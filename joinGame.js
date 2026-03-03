//creating local variables to store playernames and gamecode. will be used to add player to lobby.
let playerName
let gameCode

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

    fetch(`http://trinity-developments.co.uk/games/${gameCode}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            playerName: playerName
        })   
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log("Server response:", data);
        localStorage.setItem('playerName', data.playerName);
        localStorage.setItem('playerID', data.playerId);
        localStorage.setItem('gameId', gameCode);
        window.location.href = "/lobbyPage.html";
    })
})