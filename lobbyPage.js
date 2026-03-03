const gameId = localStorage.getItem('gameId');
const playerID = localStorage.getItem('playerID')

document.getElementById('gameCodeDisplay').textContent = gameId;

document.getElementById('startButton').addEventListener("click", function(){
    fetch(`http://trinity-developments.co.uk/games/${gameId}/start/${playerID}`, {
        method: 'PATCH',
        //mode: 'no-cors', //TEMPORARY FIX THIS MEANS WE CANT READ RESPONSE FROM SERvER ASK NICK ABOUT CORS STUFF ON SERVER. THIS SHOULD BE A PATCH REQUEST BUT HAS BEEN CHANGED TO POST AS CORS BLOCKING DOES NOT ALLOW PATCH
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: "Lobby closed, Game started",
            gameId: "${gameId}",
            state: "fugitive"
        })
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        window.location.href = '/gamePage.html';
    })
})