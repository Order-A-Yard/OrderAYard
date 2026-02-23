document.getElementById('startButton').addEventListener('click', function() {
    fetch('http://trinity-developments.co.uk/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: "JS Test POST3",
            mapId: 1,
            gameLength: "short"
        })   
    })
    .then(res => res.json())
    .then(data => {
        localStorage.setItem('gameId', data.gameId);
        console.log("game ID:", data.id);
        console.log("game ID:", data);
        window.location.href = "/lobbyPage.html";
    })
});

