import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import { socket } from "../socket";

const Map = () => {
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const routingRef = useRef(null);

    const [eta, setEta] = useState(null);

    useEffect(() => {
        // Initialize map
        mapRef.current = L.map("map").setView([12.9716, 77.5946], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap",
        }).addTo(mapRef.current);

        // 🚑 Custom icon
        const ambulanceIcon = L.icon({
            iconUrl: "https://cdn-icons-png.flaticon.com/512/2967/2967350.png",
            iconSize: [40, 40],
        });

        socket.on("ambulance_location_update", (data) => {
            console.log("📍 Live:", data);

            const { lat, lng, patientLat, patientLng } = data;

            // 🚑 Marker update
            if (!markerRef.current) {
                markerRef.current = L.marker([lat, lng], { icon: ambulanceIcon })
                    .addTo(mapRef.current)
                    .bindPopup("🚑 Ambulance")
                    .openPopup();
            } else {
                markerRef.current.setLatLng([lat, lng]);
            }

            mapRef.current.setView([lat, lng]);

            // 🔥 ROUTE
            if (patientLat && patientLng) {
                if (routingRef.current) {
                    mapRef.current.removeControl(routingRef.current);
                }

                routingRef.current = L.Routing.control({
                    waypoints: [
                        L.latLng(lat, lng),
                        L.latLng(patientLat, patientLng),
                    ],
                    routeWhileDragging: false,
                    addWaypoints: false,
                    draggableWaypoints: false,
                }).addTo(mapRef.current);

                // ⏱ ETA
                routingRef.current.on("routesfound", function (e) {
                    const route = e.routes[0];
                    const time = route.summary.totalTime / 60;

                    setEta(Math.round(time));
                });
            }
        });

        return () => {
            socket.off("ambulance_location_update");
        };
    }, []);

    return (
        <>
            <div id="map" style={{ height: "100vh", width: "100%" }} />

            {/* 🔥 ETA UI */}
            {eta && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#111",
                        color: "#fff",
                        padding: "12px 20px",
                        borderRadius: "10px",
                        fontWeight: "bold",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                    }}
                >
                    🚑 Arriving in {eta} mins
                </div>
            )}

            {/* 🔥 DRIVER CARD */}
            <div
                style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    background: "#fff",
                    padding: "15px",
                    borderRadius: "12px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                }}
            >
                <h4>🚑 Ambulance Assigned</h4>
                <p>Driver: Rajesh Kumar</p>
                <p>Vehicle: KA-01-AB-1234</p>
            </div>
        </>
    );
};

export default Map;