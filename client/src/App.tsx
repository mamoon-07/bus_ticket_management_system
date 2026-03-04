import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type RouteItem = {
  id: number;
  busName: string;
  from: string;
  to: string;
  departureTime: string;
  price: number;
  seatsAvailable: number;
};

type Booking = {
  id: number;
  passengerName: string;
  routeId: number;
  routeName: string;
  from: string;
  to: string;
  departureTime: string;
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
    const seatsAvailable = randomInt(8, 35);
    const price = randomInt(25, 95);

    return {
      id: index + 1,
      busName,
      from,
      to,
      departureTime: `${hour}:${minute}`,
      price,
      seatsAvailable,
    };
  });
}

function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(1);
  const [passengerName, setPassengerName] = useState("");
  const [seats, setSeats] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOfflineDemo, setIsOfflineDemo] = useState(false);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId),
    [routes, selectedRouteId]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    void Promise.all([loadRoutes(), loadBookings()]);
  }, []);

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
      if (data.length > 0) {
        setSelectedRouteId(data[0].id);
      }
    } catch {
      const fallbackRoutes = generateRandomRoutes();
      setIsOfflineDemo(true);
      setRoutes(fallbackRoutes);
      setSelectedRouteId(fallbackRoutes[0].id);
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
      setSelectedRouteId(data[0]?.id ?? 1);
    } catch {
      const fallbackRoutes = generateRandomRoutes();
      setIsOfflineDemo(true);
      setRoutes(fallbackRoutes);
      setSelectedRouteId(fallbackRoutes[0].id);
      setMessage("Generated offline random routes.");
    }
  }

  function ensureRoutesOnSelectOpen() {
    if (routes.length === 0) {
      void generateRoutesOnServer();
    }
  }

  async function handleBooking(event: FormEvent) {
    event.preventDefault();
    if (!passengerName.trim()) {
      setMessage("Please enter passenger name.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      if (isOfflineDemo) {
        const route = routes.find((item) => item.id === selectedRouteId);
        if (!route) {
          setMessage("No route found. Generate routes first.");
          return;
        }
        if (seats > route.seatsAvailable) {
          setMessage("Not enough seats available.");
          return;
        }

        const booking: Booking = {
          id: Date.now(),
          passengerName: passengerName.trim(),
          routeId: route.id,
          routeName: route.busName,
          from: route.from,
          to: route.to,
          departureTime: route.departureTime,
          seats,
          totalPrice: seats * route.price,
        };

        setBookings((prev) => [booking, ...prev]);
        setRoutes((prev) =>
          prev.map((item) =>
            item.id === route.id
              ? { ...item, seatsAvailable: item.seatsAvailable - seats }
              : item
          )
        );
        setPassengerName("");
        setSeats(1);
        setMessage("Ticket booked in offline demo mode.");
        return;
      }

      const response = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerName: passengerName.trim(),
          routeId: selectedRouteId,
          seats,
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(payload.message ?? "Booking failed.");
        return;
      }

      setPassengerName("");
      setSeats(1);
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
              Passenger Name
              <input
                value={passengerName}
                onChange={(event) => setPassengerName(event.target.value)}
                placeholder="Enter full name"
              />
            </label>

            <label>
              Select Route
              <select
                value={selectedRouteId}
                onFocus={ensureRoutesOnSelectOpen}
                onChange={(event) => setSelectedRouteId(Number(event.target.value))}
              >
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.busName} - {route.from} to {route.to}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Seats
              <input
                type="number"
                min={1}
                max={selectedRoute?.seatsAvailable ?? 1}
                value={seats}
                onChange={(event) => setSeats(Number(event.target.value))}
              />
            </label>

            {selectedRoute ? (
              <p className="route-info">
                Departure: {selectedRoute.departureTime} | Price per Seat: $
                {selectedRoute.price} | Available Seats: {selectedRoute.seatsAvailable}
              </p>
            ) : null}

            <button type="submit" disabled={loading}>
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
                  ${route.price} | Seats Left: {route.seatsAvailable}
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
                      Seats: {booking.seats} | Departure: {booking.departureTime}
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
