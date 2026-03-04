import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type RouteItem = {
  id: number;
  busName: string;
  from: string;
  to: string;
  departureTime: string;
  price: number;
  totalSeats: number;
  seatsAvailable: number;
};

type Booking = {
  id: number;
  passengerName: string;
  routeId: number;
  routeName: string;
  from: string;
  to: string;
  travelDate: string;
  departureTime: string;
  selectedSeats?: string[];
  seats: number;
  totalPrice: number;
};

type Theme = "dark" | "light";

const API_BASE = "/api";
const CITIES = [
  "Lagos",
  "Abuja",
  "Ibadan",
  "Port Harcourt",
  "Kano",
  "Enugu",
  "Kaduna",
  "Benin",
];
const BUS_NAMES = [
  "CityLink Express",
  "SwiftLine",
  "SkyRide Deluxe",
  "Metro Cruiser",
  "Northern Star",
  "Royal Transit",
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSeatLabels(totalSeats: number) {
  return Array.from({ length: totalSeats }, (_value, index) => {
    const row = Math.floor(index / 4) + 1;
    const colLabel = ["A", "B", "C", "D"][index % 4];
    return `${row}${colLabel}`;
  });
}

function formatDateDisplay(dateText: string) {
  if (!dateText) {
    return "";
  }
  const value = new Date(dateText);
  if (Number.isNaN(value.getTime())) {
    return dateText;
  }
  return value.toLocaleDateString();
}

function generateRandomRoutes(count = 5): RouteItem[] {
  return Array.from({ length: count }, (_value, index) => {
    const from = CITIES[randomInt(0, CITIES.length - 1)];
    let to = CITIES[randomInt(0, CITIES.length - 1)];
    while (to === from) {
      to = CITIES[randomInt(0, CITIES.length - 1)];
    }

    const hour = randomInt(6, 22).toString().padStart(2, "0");
    const minute = randomInt(0, 1) === 0 ? "00" : "30";
    const busName = `${BUS_NAMES[randomInt(0, BUS_NAMES.length - 1)]} ${randomInt(101, 999)}`;
    const totalSeats = randomInt(24, 40);
    const price = randomInt(25, 95);

    return {
      id: index + 1,
      busName,
      from,
      to,
      departureTime: `${hour}:${minute}`,
      totalSeats,
      seatsAvailable: totalSeats,
      price,
    };
  });
}

function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOfflineDemo, setIsOfflineDemo] = useState(false);

  const filteredRoutes = useMemo(
    () =>
      routes.filter(
        (route) =>
          (!origin || route.from === origin) &&
          (!destination || route.to === destination)
      ),
    [destination, origin, routes]
  );

  const selectedRoute = useMemo(
    () => filteredRoutes.find((route) => route.id === selectedRouteId),
    [filteredRoutes, selectedRouteId]
  );

  const routeSeatLabels = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }
    const totalSeats = selectedRoute.totalSeats || selectedRoute.seatsAvailable || 0;
    return generateSeatLabels(totalSeats);
  }, [selectedRoute]);

  const bookedSeatSet = useMemo(() => {
    if (!selectedRoute || !travelDate) {
      return new Set<string>();
    }
    const booked = bookings
      .filter(
        (booking) => booking.routeId === selectedRoute.id && booking.travelDate === travelDate
      )
      .flatMap((booking) => booking.selectedSeats ?? []);
    return new Set(booked);
  }, [bookings, selectedRoute, travelDate]);

  const availableSeatCount = useMemo(
    () => routeSeatLabels.filter((seatLabel) => !bookedSeatSet.has(seatLabel)).length,
    [bookedSeatSet, routeSeatLabels]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    void Promise.all([loadRoutes(), loadBookings()]);
  }, []);

  useEffect(() => {
    if (filteredRoutes.length === 0) {
      setSelectedRouteId(0);
      return;
    }

    const stillExists = filteredRoutes.some((route) => route.id === selectedRouteId);
    if (!stillExists) {
      setSelectedRouteId(filteredRoutes[0].id);
    }
  }, [filteredRoutes, selectedRouteId]);

  useEffect(() => {
    setSelectedSeats([]);
  }, [selectedRouteId, travelDate, origin, destination]);

  useEffect(() => {
    setSelectedSeats((current) =>
      current.filter((seatLabel) => !bookedSeatSet.has(seatLabel))
    );
  }, [bookedSeatSet]);

  async function loadRoutes() {
    try {
      const response = await fetch(`${API_BASE}/routes`);
      if (!response.ok) {
        throw new Error("Route request failed.");
      }

      const data = (await response.json()) as RouteItem[];
      if (data.length === 0) {
        await generateRoutesOnServer();
        return;
      }

      setIsOfflineDemo(false);
      setRoutes(data);
      setSelectedRouteId(0);
    } catch {
      const fallbackRoutes = generateRandomRoutes();
      setIsOfflineDemo(true);
      setRoutes(fallbackRoutes);
      setSelectedRouteId(0);
      setMessage("Server unavailable. Using offline random routes.");
    }
  }

  async function loadBookings() {
    try {
      const response = await fetch(`${API_BASE}/bookings`);
      if (!response.ok) {
        throw new Error("Booking request failed.");
      }
      const data = (await response.json()) as Booking[];
      setBookings(data);
    } catch {
      setBookings([]);
    }
  }

  async function generateRoutesOnServer() {
    try {
      const response = await fetch(`${API_BASE}/routes/generate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Route generation failed.");
      }
      const data = (await response.json()) as RouteItem[];
      setIsOfflineDemo(false);
      setRoutes(data);
      setSelectedRouteId(0);
    } catch {
      const fallbackRoutes = generateRandomRoutes();
      setIsOfflineDemo(true);
      setRoutes(fallbackRoutes);
      setSelectedRouteId(0);
      setMessage("Generated offline random routes.");
    }
  }

  function ensureRoutesOnSelectOpen() {
    if (routes.length === 0) {
      void generateRoutesOnServer();
    }
  }

  function toggleSeatSelection(seatLabel: string) {
    if (bookedSeatSet.has(seatLabel)) {
      return;
    }
    setSelectedSeats((current) =>
      current.includes(seatLabel)
        ? current.filter((seat) => seat !== seatLabel)
        : [...current, seatLabel]
    );
  }

  async function handleBooking(event: FormEvent) {
    event.preventDefault();
    if (!origin || !destination) {
      setMessage("Please select origin and destination.");
      return;
    }
    if (origin === destination) {
      setMessage("Origin and destination must be different.");
      return;
    }
    if (!travelDate) {
      setMessage("Please select your travel date.");
      return;
    }
    if (!passengerName.trim()) {
      setMessage("Please enter passenger name.");
      return;
    }
    if (filteredRoutes.length === 0) {
      setMessage("No buses found for the selected route.");
      return;
    }
    if (!selectedRoute) {
      setMessage("Please select a bus from the available list.");
      return;
    }
    if (selectedSeats.length === 0) {
      setMessage("Please select at least one seat.");
      return;
    }
    if (selectedSeats.length > availableSeatCount) {
      setMessage("Not enough seats available.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      if (isOfflineDemo) {
        const booking: Booking = {
          id: Date.now(),
          passengerName: passengerName.trim(),
          routeId: selectedRoute.id,
          routeName: selectedRoute.busName,
          from: selectedRoute.from,
          to: selectedRoute.to,
          travelDate,
          departureTime: selectedRoute.departureTime,
          selectedSeats,
          seats: selectedSeats.length,
          totalPrice: selectedSeats.length * selectedRoute.price,
        };

        setBookings((prev) => [booking, ...prev]);
        setRoutes((prev) =>
          prev.map((item) =>
            item.id === selectedRoute.id
              ? { ...item, seatsAvailable: item.seatsAvailable - selectedSeats.length }
              : item
          )
        );
        setPassengerName("");
        setSelectedSeats([]);
        setMessage("Ticket booked in offline demo mode.");
        return;
      }

      const response = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerName: passengerName.trim(),
          routeId: selectedRouteId,
          selectedSeats,
          seats: selectedSeats.length,
          travelDate,
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(payload.message ?? "Booking failed.");
        return;
      }

      setPassengerName("");
      setSelectedSeats([]);
      setMessage("Ticket booked successfully.");
      await Promise.all([loadRoutes(), loadBookings()]);
    } catch {
      setMessage("Server connection failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(bookingId: number) {
    setLoading(true);
    setMessage("");
    try {
      if (isOfflineDemo) {
        const booking = bookings.find((item) => item.id === bookingId);
        if (!booking) {
          setMessage("Booking not found.");
          return;
        }
        setBookings((prev) => prev.filter((item) => item.id !== bookingId));
        setRoutes((prev) =>
          prev.map((item) =>
            item.id === booking.routeId
              ? { ...item, seatsAvailable: item.seatsAvailable + booking.seats }
              : item
          )
        );
        setMessage("Offline booking cancelled and seats restored.");
        return;
      }

      const response = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setMessage(payload.message ?? "Cancellation failed.");
        return;
      }

      setMessage("Booking cancelled and seats restored.");
      await Promise.all([loadRoutes(), loadBookings()]);
    } catch {
      setMessage("Server connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <h1>Bus Ticket Management</h1>
        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
        </button>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Book a Ticket</h2>
          <form onSubmit={handleBooking} className="form">
            <label>
              Origin
              <select
                value={origin}
                onFocus={ensureRoutesOnSelectOpen}
                onChange={(event) => setOrigin(event.target.value)}
              >
                <option value="">Select origin</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Destination
              <select
                value={destination}
                onFocus={ensureRoutesOnSelectOpen}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">Select destination</option>
                {CITIES.filter((city) => city !== origin).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Travel Date
              <input
                type="date"
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </label>

            {origin && destination && travelDate ? (
              filteredRoutes.length > 0 ? (
                <>
                  <label>
                    Available Buses
                    <select
                      value={selectedRouteId}
                      onFocus={ensureRoutesOnSelectOpen}
                      onChange={(event) => setSelectedRouteId(Number(event.target.value))}
                    >
                      {filteredRoutes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.busName} - {route.departureTime} - ${route.price}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedRoute ? (
                    <>
                      <p className="route-info">
                        Route: {selectedRoute.from} to {selectedRoute.to} | Departure:{" "}
                        {selectedRoute.departureTime} | Price per Seat: ${selectedRoute.price}
                      </p>
                      <div className="seat-stats">
                        <span className="chip chip-available">
                          Available: {availableSeatCount}
                        </span>
                        <span className="chip chip-selected">
                          Selected: {selectedSeats.length}
                        </span>
                        <span className="chip chip-booked">
                          Booked: {bookedSeatSet.size}
                        </span>
                      </div>
                      <div className="seat-grid" role="group" aria-label="Seat Selection">
                        {routeSeatLabels.map((seatLabel, index) => {
                          const isBooked = bookedSeatSet.has(seatLabel);
                          const isSelected = selectedSeats.includes(seatLabel);
                          const seatClass = isBooked
                            ? "seat seat-booked"
                            : isSelected
                              ? "seat seat-selected"
                              : "seat seat-available";
                          const needsAisle = (index + 1) % 2 === 0;
                          return (
                            <button
                              key={seatLabel}
                              type="button"
                              className={`${seatClass}${needsAisle ? " seat-aisle" : ""}`}
                              disabled={isBooked}
                              onClick={() => toggleSeatSelection(seatLabel)}
                            >
                              {seatLabel}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="route-info">
                  No buses available for {origin} to {destination} on{" "}
                  {formatDateDisplay(travelDate)}.
                </p>
              )
            ) : (
              <p className="route-info">
                Select origin and destination first, then choose your travel date.
              </p>
            )}

            <label>
              Passenger Name
              <input
                value={passengerName}
                onChange={(event) => setPassengerName(event.target.value)}
                placeholder="Enter full name"
              />
            </label>

            <button type="submit" disabled={loading || !selectedRoute}>
              {loading ? "Processing..." : "Book Now"}
            </button>
            <button type="button" onClick={() => void generateRoutesOnServer()}>
              Randomly Generate Routes
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Current Routes</h2>
          <div className="list">
            {routes.map((route) => (
              <article key={route.id} className="list-item">
                <div>
                  <h3>{route.busName}</h3>
                  <p>
                    {route.from} to {route.to} at {route.departureTime}
                  </p>
                </div>
                <p>
                  ${route.price} | Seats Left: {route.seatsAvailable}/{route.totalSeats}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="card full-width">
          <h2>Booked Tickets</h2>
          <div className="list">
            {bookings.length === 0 ? (
              <p className="placeholder">No tickets booked yet.</p>
            ) : (
              bookings.map((booking) => (
                <article key={booking.id} className="list-item booking-item">
                  <div>
                    <h3>{booking.passengerName}</h3>
                    <p>
                      {booking.routeName} | {booking.from} to {booking.to}
                    </p>
                    <p>
                      Date: {formatDateDisplay(booking.travelDate)} | Seats:{" "}
                      {booking.selectedSeats?.join(", ") || booking.seats} | Departure:{" "}
                      {booking.departureTime}
                    </p>
                  </div>
                  <div className="booking-actions">
                    <strong>${booking.totalPrice}</strong>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleCancel(booking.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {isOfflineDemo ? (
        <p className="message">Offline mode is active. Start server for live data.</p>
      ) : null}
      {message ? <p className="message">{message}</p> : null}
    </div>
  );
}

export default App;
