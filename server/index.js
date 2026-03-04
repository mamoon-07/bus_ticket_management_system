const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

const routes = [];

const bookings = [];
let nextBookingId = 1;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomRoutes(count = 5) {
  routes.length = 0;
  for (let index = 0; index < count; index += 1) {
    const from = CITIES[randomInt(0, CITIES.length - 1)];
    let to = CITIES[randomInt(0, CITIES.length - 1)];
    while (to === from) {
      to = CITIES[randomInt(0, CITIES.length - 1)];
    }

    const hour = String(randomInt(6, 22)).padStart(2, "0");
    const minute = randomInt(0, 1) === 0 ? "00" : "30";
    const busName = `${BUS_NAMES[randomInt(0, BUS_NAMES.length - 1)]} ${randomInt(101, 999)}`;

    const totalSeats = randomInt(24, 40);
    routes.push({
      id: index + 1,
      busName,
      from,
      to,
      departureTime: `${hour}:${minute}`,
      price: randomInt(25, 95),
      totalSeats,
      seatsAvailable: totalSeats,
    });
  }
}

function buildSeatLabels(totalSeats) {
  const labels = [];
  for (let index = 0; index < totalSeats; index += 1) {
    const row = Math.floor(index / 4) + 1;
    const col = index % 4;
    const colLabel = ["A", "B", "C", "D"][col];
    labels.push(`${row}${colLabel}`);
  }
  return labels;
}

generateRandomRoutes();

app.get("/api/routes", (_req, res) => {
  res.json(routes);
});

app.post("/api/routes/generate", (req, res) => {
  const count = Number(req.query.count);
  const routeCount = Number.isInteger(count) && count > 0 ? Math.min(count, 12) : 5;
  generateRandomRoutes(routeCount);
  bookings.length = 0;
  nextBookingId = 1;
  res.json(routes);
});

app.get("/api/bookings", (_req, res) => {
  res.json(bookings);
});

app.post("/api/bookings", (req, res) => {
  const { passengerName, routeId, seats, travelDate, selectedSeats } = req.body;
  const route = routes.find((item) => item.id === Number(routeId));

  if (!passengerName || !passengerName.trim()) {
    return res.status(400).json({ message: "Passenger name is required." });
  }

  if (!route) {
    return res.status(404).json({ message: "Selected route not found." });
  }

  if (!travelDate || !String(travelDate).trim()) {
    return res.status(400).json({ message: "Travel date is required." });
  }

  const normalizedTravelDate = String(travelDate).trim();
  const bookedSeatsForRouteAndDate = new Set(
    bookings
      .filter((booking) => booking.routeId === route.id && booking.travelDate === normalizedTravelDate)
      .flatMap((booking) => booking.selectedSeats || [])
  );
  const allRouteSeats = buildSeatLabels(route.totalSeats || route.seatsAvailable);

  let normalizedSelectedSeats = Array.isArray(selectedSeats)
    ? selectedSeats.map((seat) => String(seat).trim()).filter(Boolean)
    : [];

  if (normalizedSelectedSeats.length === 0) {
    const parsedSeats = Number(seats);
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1) {
      return res.status(400).json({ message: "Please select at least one seat." });
    }
    normalizedSelectedSeats = allRouteSeats
      .filter((seatLabel) => !bookedSeatsForRouteAndDate.has(seatLabel))
      .slice(0, parsedSeats);
  }

  normalizedSelectedSeats = [...new Set(normalizedSelectedSeats)];

  if (normalizedSelectedSeats.length === 0) {
    return res.status(400).json({ message: "Please select at least one seat." });
  }

  const hasInvalidSeat = normalizedSelectedSeats.some((seat) => !allRouteSeats.includes(seat));
  if (hasInvalidSeat) {
    return res.status(400).json({ message: "One or more selected seats are invalid." });
  }

  const alreadyBookedSeat = normalizedSelectedSeats.find((seat) => bookedSeatsForRouteAndDate.has(seat));
  if (alreadyBookedSeat) {
    return res.status(400).json({ message: `Seat ${alreadyBookedSeat} is already booked.` });
  }

  if (normalizedSelectedSeats.length > route.seatsAvailable) {
    return res.status(400).json({ message: "Not enough seats available." });
  }

  route.seatsAvailable -= normalizedSelectedSeats.length;
  const booking = {
    id: nextBookingId++,
    passengerName: passengerName.trim(),
    routeId: route.id,
    routeName: route.busName,
    from: route.from,
    to: route.to,
    travelDate: normalizedTravelDate,
    departureTime: route.departureTime,
    selectedSeats: normalizedSelectedSeats,
    seats: normalizedSelectedSeats.length,
    totalPrice: normalizedSelectedSeats.length * route.price,
  };
  bookings.push(booking);

  return res.status(201).json(booking);
});

app.delete("/api/bookings/:id", (req, res) => {
  const bookingId = Number(req.params.id);
  const bookingIndex = bookings.findIndex((booking) => booking.id === bookingId);

  if (bookingIndex === -1) {
    return res.status(404).json({ message: "Booking not found." });
  }

  const [booking] = bookings.splice(bookingIndex, 1);
  const route = routes.find((item) => item.id === booking.routeId);
  if (route) {
    route.seatsAvailable += booking.seats;
  }

  return res.json({ message: "Booking cancelled." });
});

const clientDistPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDistPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
