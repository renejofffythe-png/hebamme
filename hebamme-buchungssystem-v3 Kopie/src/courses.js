// src/courses.js
// Kursdaten werden in data/courses.json gespeichert – dort pflegst du sie per Admin-Panel

const fs   = require('fs');
const path = require('path');

const DATA_FILE     = path.join(__dirname, '../data/courses.json');
const BOOKINGS_FILE = path.join(__dirname, '../data/bookings.json');
const WAITLIST_FILE = path.join(__dirname, '../data/waitlist.json');

function ensureDataFiles() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const starterCourses = [
      { id: 'gv-3-26', type: 'birth',    title: 'Geburtsvorbereitung 3/26',               date: '14.4.–26.5.2026, 18:30 Uhr',  price: 18000, currency: 'eur', capacity: 8,  enrolled: 3, status: 'open' },
      { id: 'rb-1-26', type: 'recovery', title: 'Rückbildung mit/ohne Baby 01/26',        date: '07.01–25.02., 11:15 Uhr',      price: 12000, currency: 'eur', capacity: 10, enrolled: 9, status: 'open' },
      { id: 'rb-2-26', type: 'recovery', title: 'Rückbildung mit/ohne Baby 02/26',        date: '04.02.–25.03., 9:30 Uhr',      price: 12000, currency: 'eur', capacity: 10, enrolled: 6, status: 'open' },
      { id: 'gv-m-26', type: 'birth',    title: 'Geburtsvorbereitung Mehrgebärende 1/26', date: '15.04.–13.05. (9–11 Uhr)',     price: 14000, currency: 'eur', capacity: 6,  enrolled: 0, status: 'soon' },
      { id: 'rb-3-26', type: 'recovery', title: 'Rückbildung mit/ohne Baby 03/26',        date: '15.04.–27.05., 11:15 Uhr',     price: 12000, currency: 'eur', capacity: 10, enrolled: 0, status: 'soon' },
      { id: 'gv-4-26', type: 'birth',    title: 'Geburtsvorbereitung 4/26',               date: '18.8.–06.10.2026, 18:30 Uhr',  price: 18000, currency: 'eur', capacity: 8,  enrolled: 0, status: 'soon' },
      { id: 'gv-5-26', type: 'birth',    title: 'Geburtsvorbereitung 5/26',               date: '27.10.–08.12.2026, 18:30 Uhr', price: 18000, currency: 'eur', capacity: 8,  enrolled: 0, status: 'soon' },
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(starterCourses, null, 2));
  }
  if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]');
  if (!fs.existsSync(WAITLIST_FILE)) fs.writeFileSync(WAITLIST_FILE, '{}');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`Fehler beim Lesen von ${path.basename(file)}:`, e.message); return fallback; }
}
function readCourses()  { ensureDataFiles(); return readJson(DATA_FILE,     []); }
function writeCourses(c)        { fs.writeFileSync(DATA_FILE, JSON.stringify(c, null, 2)); }
function readBookings() { ensureDataFiles(); return readJson(BOOKINGS_FILE, []); }
function writeBookings(b)       { fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(b, null, 2)); }
function readWaitlist() { ensureDataFiles(); return readJson(WAITLIST_FILE, {}); }
function writeWaitlist(w)       { fs.writeFileSync(WAITLIST_FILE, JSON.stringify(w, null, 2)); }

function getAllCourses() {
  return readCourses().map(c => ({
    ...c,
    seats:          c.capacity - c.enrolled,
    isFull:         c.enrolled >= c.capacity,
    priceFormatted: `${(c.price / 100).toFixed(0)},– €`,
  }));
}

function getCourse(id) {
  return readCourses().find(c => c.id === id) || null;
}

function createCourse(data) {
  const price    = Math.round(parseFloat(data.price) * 100);
  const capacity = parseInt(data.capacity, 10);
  if (!data.title || !data.date)        throw new Error('Titel und Datum sind Pflicht');
  if (isNaN(price) || price <= 0)       throw new Error('Ungültiger Preis');
  if (isNaN(capacity) || capacity <= 0) throw new Error('Ungültige Kapazität');

  const courses   = readCourses();
  // Kollisionssichere ID: Timestamp + Zufallssuffix
  const newCourse = {
    id:       `kurs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type:     data.type   || 'birth',
    title:    data.title,
    date:     data.date,
    price,
    currency: 'eur',
    capacity,
    enrolled: 0,
    status:   data.status || 'soon',
  };
  courses.push(newCourse);
  writeCourses(courses);
  return newCourse;
}

function updateCourse(id, data) {
  const courses = readCourses();
  const idx     = courses.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Kurs nicht gefunden');
  courses[idx] = {
    ...courses[idx],
    type:     data.type     ?? courses[idx].type,
    title:    data.title    ?? courses[idx].title,
    date:     data.date     ?? courses[idx].date,
    price:    data.price    != null ? Math.round(parseFloat(data.price) * 100) : courses[idx].price,
    capacity: data.capacity != null ? parseInt(data.capacity, 10)              : courses[idx].capacity,
    enrolled: data.enrolled != null ? parseInt(data.enrolled, 10)              : courses[idx].enrolled,
    status:   data.status   ?? courses[idx].status,
  };
  writeCourses(courses);
  return courses[idx];
}

function deleteCourse(id) {
  const courses  = readCourses();
  const filtered = courses.filter(c => c.id !== id);
  if (filtered.length === courses.length) throw new Error('Kurs nicht gefunden');
  writeCourses(filtered);
}

function incrementEnrolled(id) {
  const courses = readCourses();
  const c       = courses.find(x => x.id === id);
  if (!c) throw new Error('Kurs nicht gefunden');
  if (c.enrolled >= c.capacity) throw new Error('Kurs ist ausgebucht');
  c.enrolled += 1;
  writeCourses(courses);
  return c;
}

function saveBooking(booking) {
  const bookings = readBookings();
  bookings.push({ ...booking, bookedAt: new Date().toISOString() });
  writeBookings(bookings);
}

function getBookingsForCourse(courseId) { return readBookings().filter(b => b.courseId === courseId); }
function getAllBookings()                { return readBookings(); }

function addToWaitlist(courseId, email, name) {
  const wl = readWaitlist();
  if (!wl[courseId]) wl[courseId] = [];
  wl[courseId].push({ email, name, addedAt: new Date().toISOString() });
  writeWaitlist(wl);
  return wl[courseId].length;
}

function getWaitlist(courseId)    { return readWaitlist()[courseId] || []; }
function getAllWaitlists()         { return readWaitlist(); }
function removeFromWaitlist(courseId, email) {
  const wl = readWaitlist();
  if (wl[courseId]) { wl[courseId] = wl[courseId].filter(e => e.email !== email); writeWaitlist(wl); }
}

module.exports = {
  getAllCourses, getCourse, createCourse, updateCourse, deleteCourse, incrementEnrolled,
  saveBooking, getBookingsForCourse, getAllBookings,
  addToWaitlist, getWaitlist, getAllWaitlists, removeFromWaitlist,
};
