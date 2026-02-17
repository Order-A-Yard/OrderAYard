document.getElementById('readyButton').addEventListener('click', function() {
    fetch('http://trinity-developments.co.uk/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: "JS Test POST2",
            mapId: 1,
            gameLength: "short"
        })   
    })
    .then (res => res.json())
    .then (data => {window.location.href = "/gamePage.html"})
})