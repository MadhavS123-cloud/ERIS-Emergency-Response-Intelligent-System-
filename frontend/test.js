const lat = 12.9716; const lng = 77.5946;
const query = `[out:json];(node["amenity"="hospital"](around:8000, ${lat}, ${lng});way["amenity"="hospital"](around:8000, ${lat}, ${lng}););out center;`;
fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query))
    .then(r => r.json())
    .then(data => {
        console.log("Found:", data.elements.length);
        console.log("Named:", data.elements.filter(el => el.tags && el.tags.name).length);
        console.log(data.elements.filter(el => el.tags && el.tags.name).map(n => n.tags.name).slice(0, 10));
    })
    .catch(console.error);
