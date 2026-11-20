import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bath, BedDouble, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee,
  Download, KeyRound, Leaf, LogOut, Mail, Menu, MessageCircle,
  MoreHorizontal, Plus, Search, Settings2, Sparkles, Users, Wifi, X,
} from 'lucide-react'
import { apiRequest, downloadFile } from './api'
import './App.css'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'
const appRole = (role) => ({
  super_admin: 'owner',
  admin: 'owner',
  receptionist: 'reception',
  housekeeping: 'housekeeping',
  guest: 'guest',
}[role] || role)

const photos = {
  hero: [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=2200&q=88',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2200&q=88',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=88',
  ],
  rooms: [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=85',
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=85',
  ],
  gallery: [
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=85',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=85',
    'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=85',
  ],
}

const roomSeed = [
  { number: '101', type: 'Garden Suite', status: 'occupied', guest: 'Aarav Mehta', until: 'Today, 11:00 am', price: 6400 },
  { number: '102', type: 'Deluxe King', status: 'available', guest: '', until: '', price: 4800 },
  { number: '103', type: 'Garden Suite', status: 'cleaning', guest: '', until: 'Ready by 12:30 pm', price: 6400 },
  { number: '104', type: 'Courtyard Twin', status: 'occupied', guest: 'Maya Shah', until: 'Tomorrow, 10:00 am', price: 5200 },
  { number: '105', type: 'Deluxe King', status: 'available', guest: '', until: '', price: 4800 },
  { number: '106', type: 'Palm Residence', status: 'maintenance', guest: '', until: 'AC service', price: 8200 },
  { number: '201', type: 'Palm Residence', status: 'occupied', guest: 'Ishaan Rao', until: 'Today, 1:00 pm', price: 8200 },
  { number: '202', type: 'Deluxe King', status: 'available', guest: '', until: '', price: 4800 },
  { number: '203', type: 'Courtyard Twin', status: 'available', guest: '', until: '', price: 5200 },
  { number: '204', type: 'Garden Suite', status: 'occupied', guest: 'Neha Kulkarni', until: 'Nov 22, 11:00 am', price: 6400 },
  { number: '205', type: 'Deluxe King', status: 'cleaning', guest: '', until: 'Ready by 1:00 pm', price: 4800 },
  { number: '206', type: 'Courtyard Twin', status: 'available', guest: '', until: '', price: 5200 },
]
const roomTypeSeed = [...new Set(roomSeed.map((room) => room.type))].map((name, index) => ({
  id: `demo-type-${index}`,
  name,
  base_price: roomSeed.find((room) => room.type === name).price,
}))

const navItems = [
  { label: 'Overview', icon: Sparkles, roles: ['owner', 'reception', 'housekeeping'] },
  { label: 'Rooms', icon: BedDouble, roles: ['owner', 'reception', 'housekeeping'] },
  { label: 'Bookings', icon: CalendarDays, roles: ['owner', 'reception'] },
  { label: 'Guests', icon: Users, roles: ['owner', 'reception'] },
  { label: 'Revenue', icon: ArrowUpRight, roles: ['owner'] },
  { label: 'Expenses', icon: Download, roles: ['owner'] },
  { label: 'Team & access', icon: KeyRound, roles: ['owner'] },
]

const statusNames = { available: 'Available', occupied: 'Occupied', cleaning: 'Cleaning', maintenance: 'Maintenance' }
const titleCase = (value) => String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const localDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const dateToday = localDate(new Date())
const dateAfterTwoNights = localDate(new Date(Date.now() + 86400000 * 2))
const bookingErrorMessage = (message, room) => {
  if (!/(?:cannot|can't|unable to|could not).{0,40}book.{0,40}(?:room|time)|book.{0,40}at this time/i.test(message)) return message
  const place = room ? `Room ${room.number}` : 'a room of this type'
  return `We couldn't reserve ${place} for those dates. It may already be booked or not ready. Try different dates or another room type. If you still need help, contact reception.`
}

function readDemoList(key, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [slide, setSlide] = useState(0)
  const [page, setPage] = useState(() => localStorage.getItem('serein-user') ? 'dashboard' : 'home')
  const [modal, setModal] = useState(null)
  const [bookCheckIn, setBookCheckIn] = useState(dateToday)
  const [bookCheckOut, setBookCheckOut] = useState(dateAfterTwoNights)
  const [bookGuests, setBookGuests] = useState('2')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('serein-user') || 'null') } catch { return null }
  })
  const [csrfToken, setCsrfToken] = useState(() => localStorage.getItem('serein-csrf') || '')
  const [bookings, setBookings] = useState(() => DEMO_MODE ? readDemoList('serein-bookings', []) : [])
  const [rooms, setRooms] = useState(() => DEMO_MODE ? readDemoList('serein-rooms', roomSeed) : [])
  const [roomTypes, setRoomTypes] = useState(() => DEMO_MODE ? roomTypeSeed : [])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % photos.hero.length), 6500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let active = true
    apiRequest('/auth/session')
      .then((result) => {
        if (!active) return
        if (result.user) {
          const currentUser = { ...result.user, role: appRole(result.user.role), permissions: result.permissions || [] }
          setUser(currentUser)
          localStorage.setItem('serein-user', JSON.stringify(currentUser))
          setCsrfToken(result.csrfToken || '')
          if (result.csrfToken) localStorage.setItem('serein-csrf', result.csrfToken)
          refreshLiveData(currentUser.permissions)
        } else {
          setUser(null)
          localStorage.removeItem('serein-user')
        }
      })
      .catch((error) => { if (active) setToast(error.message) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    localStorage.setItem('serein-bookings', JSON.stringify(bookings))
  }, [bookings])

  useEffect(() => {
    if (DEMO_MODE) localStorage.setItem('serein-rooms', JSON.stringify(rooms))
  }, [rooms])

  const role = appRole(user?.role || 'reception')
  const filteredRooms = useMemo(() => rooms.filter((room) => (
    (filter === 'all' || room.status === filter)
    && `${room.number} ${room.type} ${room.guest}`.toLowerCase().includes(search.toLowerCase())
  )), [rooms, filter, search])

  async function refreshLiveData(permissions) {
    try {
      if (permissions.includes('rooms.view')) {
        const result = await apiRequest('/rooms')
        setRooms(result.rooms
          .filter((room) => room.status !== 'inactive')
          .map((room) => ({
            id: Number(room.id),
            number: room.room_number,
            type: room.room_type,
            status: room.status,
            guest: room.current_guest || '',
            until: room.current_check_out || '',
            price: Number(room.base_price),
          })))
      }
      if (permissions.includes('rooms.create')) {
        const typeResult = await apiRequest('/room-types')
        setRoomTypes(typeResult.room_types)
      }
      if (permissions.includes('bookings.view')) {
        const result = await apiRequest('/bookings')
        setBookings(result.bookings.map((booking) => ({
          ...booking,
          id: booking.booking_reference,
          name: booking.guest_name,
          roomNumber: booking.room_number,
          roomType: booking.room_type,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          total: Number(booking.total_amount),
          source: booking.source === 'ota' ? (booking.source_name || 'OTA') : booking.source,
          status: booking.status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          statusValue: booking.status,
          databaseId: Number(booking.id),
        })))
      }
    } catch (error) {
      setToast(error.message)
    }
  }

  async function signIn(form) {
    let nextUser
    if (DEMO_MODE) {
      nextUser = { name: form.name || 'Aarav Shah', role: form.role, email: form.email }
    } else {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: form.email, password: form.password },
      })
      nextUser = { ...result.user, role: appRole(result.user.role), permissions: result.permissions || [] }
      setCsrfToken(result.csrfToken)
      localStorage.setItem('serein-csrf', result.csrfToken)
      await refreshLiveData(nextUser.permissions)
    }
    setUser(nextUser)
    localStorage.setItem('serein-user', JSON.stringify(nextUser))
    setPage('dashboard')
    setModal(null)
    setToast(`Welcome back, ${nextUser.name.split(' ')[0]}`)
  }

  async function signOut() {
    if (!DEMO_MODE) {
      try {
        await apiRequest('/auth/logout', { method: 'POST', csrfToken })
      } catch (error) {
        setToast(error.message)
      }
    }
    setUser(null)
    localStorage.removeItem('serein-user')
    localStorage.removeItem('serein-csrf')
    setCsrfToken('')
    setPage('home')
  }

  async function saveBooking(form) {
    if (!DEMO_MODE) {
      const result = await apiRequest('/bookings', {
        method: 'POST',
        csrfToken: user ? csrfToken : undefined,
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          check_in: form.checkIn,
          check_out: form.checkOut,
          room_type: form.roomType,
          ...(form.roomId ? { room_id: form.roomId } : {}),
          source: form.source,
          source_name: form.sourceName,
          adults: form.adults,
          guest_remarks: form.remarks,
        },
      })
      if (user?.permissions) await refreshLiveData(user.permissions)
      setModal(null)
      setToast(`Booking request received · ${result.reference}`)
      return
    }
    const newBooking = { ...form, id: `SR-DEMO-${bookings.length + 1}`, status: 'Confirmed', statusValue: 'confirmed' }
    setBookings((items) => [newBooking, ...items])
    setRooms((items) => items.map((room) => room.number === form.roomNumber
      ? { ...room, status: 'occupied', guest: form.name, until: form.checkOut }
      : room))
    setModal(null)
    setToast(`Demo booking saved on this browser · ${newBooking.id}`)
  }

  async function sendContact(formElement) {
    const data = new FormData(formElement)
    try {
      if (DEMO_MODE) {
        setToast('Preview only — connect the PHP API to save contact messages.')
      } else {
        await apiRequest('/contact', {
          method: 'POST',
          body: { name: data.get('name'), email: data.get('email'), message: data.get('message') },
        })
        setToast('Thank you — we’ll be in touch soon.')
      }
      formElement.reset()
    } catch (error) {
      setToast(error.message)
    }
  }

  async function exportRevenue(from, to, channel) {
    try {
      if (!DEMO_MODE) {
        await downloadFile(`/reports/revenue.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&channel=${encodeURIComponent(channel)}`)
      } else {
        const headers = ['Stay date', 'Booking reference', 'Guest', 'Room', 'Source', 'Total']
        const rows = bookings.filter((booking) => (
          channel === 'all'
          || (channel === 'ota' && booking.source === 'ota')
          || (channel === 'walk_in' && booking.source === 'walk_in')
          || (channel === 'pending' && Number(booking.total) > 0)
        )).map((booking) => [
          booking.checkIn,
          booking.id,
          booking.name,
          booking.roomType,
          booking.source,
          booking.total,
        ])
        const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
        const csv = [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')
        const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `serein-demo-revenue-${from}-to-${to}.csv`
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setToast(DEMO_MODE ? 'Demo revenue report downloaded as CSV.' : 'Revenue report downloaded as CSV.')
    } catch (error) {
      setToast(error.message)
    }
  }

  async function updateRoom(roomNumber, status) {
    const room = rooms.find((item) => item.number === roomNumber)
    if (!DEMO_MODE && room?.id) {
      try {
        await apiRequest(`/rooms/${room.id}`, { method: 'PATCH', csrfToken, body: { status } })
      } catch (error) {
        setToast(error.message)
        return
      }
    }
    setRooms((items) => items.map((room) => room.number === roomNumber
      ? { ...room, status, guest: status === 'available' ? '' : room.guest }
      : room))
    setModal(null)
    setToast(`Room ${roomNumber} marked ${statusNames[status].toLowerCase()}`)
  }

  async function createRoom(form) {
    const roomType = roomTypes.find((item) => String(item.id) === String(form.room_type_id))
    if (!roomType) throw new Error('Choose a valid room type.')
    if (!DEMO_MODE) {
      const result = await apiRequest('/rooms', { method: 'POST', csrfToken, body: form })
      setRooms((items) => [...items, {
        id: Number(result.id),
        number: result.room_number,
        type: roomType.name,
        status: result.status,
        guest: '',
        until: '',
        price: Number(roomType.base_price),
      }].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })))
    } else {
      const status = form.status
      setRooms((items) => [...items, {
        id: `demo-room-${Date.now()}`,
        number: form.room_number,
        type: roomType.name,
        status,
        guest: '',
        until: '',
        price: Number(roomType.base_price),
      }].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })))
    }
    setToast(`Room ${form.room_number} added and ready for bookings.`)
  }

  async function updateBooking(booking, status, staffRemarks) {
    if (!DEMO_MODE) {
      if (!Number.isSafeInteger(Number(booking.databaseId)) || Number(booking.databaseId) < 1) {
        setToast('This booking cannot be updated because its database ID is missing. Refresh the bookings list and try again.')
        return
      }
      try {
        await apiRequest(`/bookings/${booking.databaseId}`, { method: 'PATCH', csrfToken, body: { status, staff_remarks: staffRemarks } })
        await refreshLiveData(user.permissions)
      } catch (error) {
        setToast(error.message)
        return
      }
    } else {
      setBookings((items) => {
        const existing = items.some((item) => item.id === booking.id)
        const updated = { ...booking, staff_remarks: staffRemarks, status: status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), statusValue: status }
        return existing ? items.map((item) => item.id === booking.id ? { ...item, ...updated } : item) : [updated, ...items]
      })
    }
    setToast(`Booking ${booking.id} updated`)
  }

  async function sendGuestNote(booking, note) {
    if (!DEMO_MODE) {
      try {
        await apiRequest(`/bookings/${booking.databaseId}/notes`, {
          method: 'POST',
          csrfToken,
          body: { note },
        })
        await refreshLiveData(user.permissions)
      } catch (error) {
        setToast(error.message)
        return false
      }
    } else {
      setBookings((items) => items.map((item) => item.id === booking.id
        ? { ...item, latest_guest_note: note }
        : item))
    }
    setToast('Your note has been sent to the team.')
    return true
  }

  if (page === 'dashboard' && user) {
    return <Dashboard
      user={user}
      role={role}
      guestEmail={user.email}
      currentUserEmail={user.email}
      onExportRevenue={exportRevenue}
      csrfToken={csrfToken}
      onToast={setToast}
      modal={modal}
      onCloseModal={() => setModal(null)}
      onLogin={signIn}
      onBooking={saveBooking}
      rooms={rooms}
      roomTypes={roomTypes}
      canCreateRooms={DEMO_MODE ? role === 'owner' : user.permissions?.includes('rooms.create')}
      onCreateRoom={createRoom}
      filteredRooms={filteredRooms}
      bookings={bookings}
      filter={filter}
      setFilter={setFilter}
      search={search}
      setSearch={setSearch}
      onNavigate={(nextPage) => setPage(nextPage)}
      onSignOut={signOut}
      onNewBooking={() => setModal({ type: 'booking' })}
      onRoomClick={(room) => setModal({ type: 'room', room })}
      onRoomStatus={updateRoom}
      onRoomBooking={(room) => setModal({ type: 'booking', room })}
      onUpdateBooking={updateBooking}
      onGuestNote={sendGuestNote}
      toast={toast}
    />
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Serein House home" onClick={() => setPage('home')}>
          <span className="brand-mark"><Leaf size={22} strokeWidth={1.5} /></span>
          <span className="brand-name">serein<span>house</span><small>STAY A LITTLE CLOSER</small></span>
        </a>
        <nav className="public-nav" aria-label="Main navigation">
          <a href="#stay">The stay</a><a href="#experience">Experiences</a><a href="#story">Our story</a><a href="#contact">Find us</a>
        </nav>
        <div className="header-actions">
          <button className="text-button staff-link" onClick={() => setModal({ type: 'login' })}><KeyRound size={15} /> Staff login</button>
          <a className="button button-dark header-book" href="#book">Book your stay <ArrowRight size={15} /></a>
          <button className="icon-button mobile-menu" aria-label="Open menu"><Menu size={21} /></button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-image" style={{ backgroundImage: `url("${photos.hero[slide]}")` }} key={slide} />
          <div className="hero-scrim" />
          <div className="hero-content">
            <p className="eyebrow eyebrow-light"><span /> A SLOWER KIND OF STAY · GOA, INDIA</p>
            <h1>Find your way<br />back to <em>slow.</em></h1>
            <p className="hero-copy">A quieter corner of Goa, tucked between old palms and the Arabian Sea. Come as you are; leave a little lighter.</p>
            <a className="button button-light" href="#stay">Discover Serein <ArrowRight size={16} /></a>
          </div>
          <div className="hero-caption"><span>01 — 03</span><span className="caption-line" /><span>THE GARDEN WING</span></div>
          <div className="slide-controls" aria-label="Hero slideshow controls">
            <button aria-label="Previous slide" onClick={() => setSlide((slide + photos.hero.length - 1) % photos.hero.length)}><ChevronLeft size={17} /></button>
            <button aria-label="Next slide" onClick={() => setSlide((slide + 1) % photos.hero.length)}><ChevronRight size={17} /></button>
          </div>
          <div className="hero-vertical">N 15° 33' 17.4" &nbsp; E 73° 45' 07.2"</div>
        </section>

        <section className="booking-wrap" id="book">
          <form className="booking-bar" onSubmit={(event) => { event.preventDefault(); setModal({ type: 'booking', checkIn: bookCheckIn, checkOut: bookCheckOut, guests: bookGuests }) }}>
            <label className="booking-field"><span>CHECK IN</span><div><CalendarDays size={16} /><input type="date" min={dateToday} value={bookCheckIn} onChange={(event) => setBookCheckIn(event.target.value)} aria-label="Check in date" /></div></label>
            <label className="booking-field"><span>CHECK OUT</span><div><CalendarDays size={16} /><input type="date" min={bookCheckIn} value={bookCheckOut} onChange={(event) => setBookCheckOut(event.target.value)} aria-label="Check out date" /></div></label>
            <label className="booking-field guests-field"><span>GUESTS</span><div><Users size={16} /><select aria-label="Number of guests" value={bookGuests} onChange={(event) => setBookGuests(event.target.value)}><option value="2">2 guests</option><option value="1">1 guest</option><option value="3">3 guests</option><option value="4">4 guests</option></select><ChevronDown size={14} /></div></label>
            <button className="button button-green booking-submit" type="submit">Find your room <ArrowRight size={16} /></button>
          </form>
          <div className="booking-note"><span>BEST RATE GUARANTEED</span><i /> Free cancellation up to 48 hours before arrival</div>
        </section>

        <section className="intro-section content-width" id="story">
          <div className="intro-label"><span className="eyebrow">A HOME IN THE HUSH</span><span className="intro-number">01 / THE PLACE</span></div>
          <div className="intro-copy">
            <h2>Some places ask you<br />to do <em>nothing.</em></h2>
            <div className="intro-right">
              <p>Set in the old village of Assagao, Serein House is a collection of 28 thoughtfully made rooms, a garden that takes its time, and the feeling that you have nowhere else to be.</p>
              <a className="underlined-link" href="#experience">Get to know us <ArrowRight size={15} /></a>
            </div>
          </div>
          <div className="intro-ornament" aria-hidden="true">✳</div>
        </section>

        <section className="stay-section" id="stay">
          <div className="content-width">
            <div className="section-heading">
              <div><p className="eyebrow">REST, YOUR WAY</p><h2>Rooms with <em>room to breathe.</em></h2></div>
              <a className="underlined-link" href="#book">Explore all rooms <ArrowRight size={15} /></a>
            </div>
            <div className="room-cards">
              {[
                { title: 'The Courtyard', description: 'A calm little world around your own private patio.', price: '₹4,800', tag: 'A QUIET FAVOURITE', image: photos.rooms[0], detail: 'Deluxe King · 2 guests · 32 m²' },
                { title: 'The Garden Suite', description: 'Wake up to green, with a garden just beyond your door.', price: '₹6,400', tag: 'ROOM TO UNWIND', image: photos.rooms[1], detail: 'King bed · Private balcony · 42 m²' },
                { title: 'The Palm Residence', description: 'Our most generous hideaway for longer, slower stays.', price: '₹8,200', tag: 'A LITTLE EXTRA', image: photos.rooms[2], detail: 'King bed · Garden view · 58 m²' },
              ].map((room, index) => (
                <article className="stay-card" key={room.title}>
                  <div className="stay-image-wrap"><img src={room.image} alt={`${room.title} guest room`} loading="lazy" /><span className="stay-tag">{room.tag}</span><span className="stay-index">0{index + 1}</span></div>
                  <div className="stay-card-body">
                    <div className="stay-title-row"><h3>{room.title}</h3><span className="room-price">{room.price}<small> / night</small></span></div>
                    <p>{room.description}</p><div className="room-features"><span><BedDouble size={14} /> {room.detail}</span><span><Wifi size={14} /> Wi-Fi</span></div>
                    <button className="underlined-link card-link" onClick={() => setModal({ type: 'booking', roomType: room.title })}>Make it yours <ArrowRight size={15} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="experience-section" id="experience">
          <div className="content-width">
            <div className="section-heading experience-heading"><div><p className="eyebrow">AROUND THE HOUSE</p><h2>Stay for the <em>feeling.</em></h2></div><p className="experience-intro">The best moments here aren't on a schedule. But if you need a few ideas, there's plenty to find.</p></div>
            <div className="gallery-grid">
              <figure className="gallery-large"><img src={photos.gallery[0]} alt="Sunlit pool surrounded by palms" loading="lazy" /><figcaption>01 <span>THE PALM POOL</span></figcaption></figure>
              <figure><img src={photos.gallery[1]} alt="A warm, sunlit lounge" loading="lazy" /><figcaption>02 <span>SLOW MORNINGS</span></figcaption></figure>
              <figure><img src={photos.gallery[2]} alt="Natural textures in a guest suite" loading="lazy" /><figcaption>03 <span>THOUGHTFUL DETAILS</span></figcaption></figure>
              <figure><img src={photos.gallery[3]} alt="The hotel's garden pool at dusk" loading="lazy" /><figcaption>04 <span>GARDEN EVENINGS</span></figcaption></figure>
            </div>
            <div className="amenity-strip"><span><Coffee size={17} /> Breakfast, unhurried</span><i /><span><Bath size={17} /> Garden-side pool</span><i /><span><Sparkles size={17} /> Little local discoveries</span><i /><span><MessageCircle size={17} /> Here whenever you need</span></div>
          </div>
        </section>

        <section className="quote-section">
          <div className="quote-mark">“</div><blockquote>It felt less like checking into a hotel<br />and more like being <em>let in on a secret.</em></blockquote>
          <div className="quote-rating"><span>★★★★★</span><small>ANANYA M. &nbsp;·&nbsp; NOVEMBER 2025</small></div>
        </section>

        <section className="contact-section content-width" id="contact">
          <div><p className="eyebrow">COME FIND US</p><h2>We’ll leave<br />the light <em>on.</em></h2></div>
          <div className="contact-details"><p>Vagator–Anjuna Road, Assagao<br />Bardez, Goa 403507, India</p><a href="mailto:hello@sereinhouse.in">hello@sereinhouse.in</a><a href="tel:+918322451080">+91 832 245 1080</a><div className="social-links"><a href="https://instagram.com" aria-label="Instagram">ig</a><a href="https://facebook.com" aria-label="Facebook">f</a><a href="mailto:hello@sereinhouse.in" aria-label="Email us"><Mail size={17} /></a></div></div>
          <form className="contact-form" onSubmit={(event) => { event.preventDefault(); sendContact(event.currentTarget) }}>
            <label>Your name<input name="name" required placeholder="How should we call you?" /></label><label>Your email<input name="email" type="email" required placeholder="you@example.com" /></label><label>A little note<textarea name="message" rows="2" placeholder="Tell us what’s on your mind" /></label><button className="underlined-link" type="submit">Send us a note <ArrowRight size={15} /></button>
          </form>
        </section>
      </main>
      <footer className="site-footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Leaf size={20} /></span><span className="brand-name">serein<span>house</span><small>STAY A LITTLE CLOSER</small></span></a><span>© 2026 Serein House. Made with care in Goa.</span><div><a href="#contact">Privacy</a><a href="#contact">Accessibility</a><a href="#contact">Sitemap</a><button onClick={() => setModal({ type: 'login' })}>Staff</button></div></footer>
      {modal && <Modal type={modal.type} roomType={modal.roomType} room={modal.room} checkIn={modal.checkIn} checkOut={modal.checkOut} guests={modal.guests} onClose={() => setModal(null)} onLogin={signIn} onBooking={saveBooking} onRoomStatus={updateRoom} onRoomBooking={(room) => setModal({ type: 'booking', room })} />}
      <AccessibilityWidget />
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </div>
  )
}

function Dashboard({ user, role, guestEmail, currentUserEmail, onExportRevenue, onUpdateBooking, onGuestNote, csrfToken, onToast, modal, onCloseModal, onLogin, onBooking, rooms, roomTypes, canCreateRooms, onCreateRoom, filteredRooms, bookings, filter, setFilter, search, setSearch, onNavigate, onSignOut, onNewBooking, onRoomClick, onRoomStatus, onRoomBooking, toast }) {
  const [activeNav, setActiveNav] = useState(role === 'guest' ? 'My stays' : 'Overview')
  const visibleNav = role === 'guest'
    ? [{ label: 'My stays', icon: CalendarDays, roles: ['guest'] }]
    : navItems.filter((item) => item.roles.includes(role))
  const occupied = rooms.filter((room) => room.status === 'occupied').length
  const available = rooms.filter((room) => room.status === 'available').length

  function navigate(label) { setActiveNav(label); onNavigate('dashboard') }
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <a className="brand dashboard-brand" href="#" onClick={(event) => { event.preventDefault(); onNavigate('home') }}><span className="brand-mark"><Leaf size={21} /></span><span className="brand-name">serein<span>house</span><small>HOUSEKEEPING, MADE HUMAN</small></span></a>
        <div className="property-switch"><span className="property-dot" /><span><strong>Serein House</strong><small>Assagao, Goa</small></span><ChevronDown size={15} /></div>
        <p className="side-label">PROPERTY</p>
        <nav className="side-nav" aria-label="Property management">
          {visibleNav.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'active' : ''} onClick={() => navigate(label)}><Icon size={17} /><span>{label}</span>{label === 'Bookings' && bookings.length > 0 && <span className="nav-count">{bookings.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="help-card" onClick={() => setActiveNav('Settings')}><CircleHelp size={17} /><span><strong>Need a hand?</strong><small>Visit the help centre</small></span><ArrowUpRight size={14} /></button><div className="side-user"><span className="avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{user.name}</strong><small>{role === 'owner' ? 'Property owner' : role === 'housekeeping' ? 'Housekeeping' : role === 'guest' ? 'Guest' : 'Receptionist'}</small></span><button aria-label="Sign out" onClick={onSignOut}><LogOut size={15} /></button></div></div>
      </aside>
      <main className="dash-main">
        <header className="dash-topbar"><div className="breadcrumb">Serein House <span>/</span> {activeNav}</div><div className="dash-top-actions">{DEMO_MODE && <span className="demo-badge">DEMO</span>}<span className="today-date"><CalendarDays size={15} /> Wednesday, November 19</span><button className="icon-button" aria-label="Settings" onClick={() => setActiveNav('Settings')}><Settings2 size={18} /></button><button className="avatar top-avatar" aria-label="Profile">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</button></div></header>
        <div className="dash-content">
          <div className="dash-heading"><div><p className="eyebrow">WEDNESDAY · NOVEMBER 19, 2026</p><h1>{activeNav === 'Overview' ? `Good morning, ${user.name.split(' ')[0]}.` : activeNav}</h1><p className="dash-subtitle">{activeNav === 'Overview' ? 'Here’s what’s happening around the house today.' : `A clear view of ${activeNav.toLowerCase()} at Serein House.`}</p></div>{role !== 'guest' && <button className="button button-green" onClick={onNewBooking}><Plus size={17} /> New booking</button>}</div>
          {activeNav === 'Overview' || activeNav === 'Rooms' ? (
            <>
              {role !== 'housekeeping' && <div className="metrics-grid">
                <MetricCard label="TODAY'S REVENUE" value="₹42,800" trend="12.8%" positive note="vs. last Wednesday" icon={ArrowUpRight} />
                <MetricCard label="ROOMS OCCUPIED" value={`${occupied} / ${rooms.length}`} trend="72%" positive note="occupancy today" icon={BedDouble} />
                <MetricCard label="ARRIVALS TODAY" value="04" trend="02 checked in" positive={false} note="2 still to welcome" icon={ArrowDownRight} />
                <MetricCard label="READY TO WELCOME" value={available} trend="Rooms available" positive note="at your property" icon={Sparkles} />
              </div>}
              <section className="room-panel">
                <div className="panel-heading"><div><h2>Rooms at a glance</h2><p>A little overview of the house, as it is right now.</p></div><div className="panel-actions"><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a room..." /></label><button className="outline-button" onClick={onNewBooking}><Plus size={15} /> Add booking</button><button className="more-button" aria-label="More room options"><MoreHorizontal size={19} /></button></div></div>
                <div className="room-legend">{['all', 'available', 'occupied', 'cleaning', 'maintenance'].map((state) => <button key={state} className={filter === state ? 'selected' : ''} onClick={() => setFilter(state)}><i className={`legend-dot ${state}`} />{state === 'all' ? `All rooms · ${rooms.length}` : statusNames[state]}</button>)}</div>
                <div className="room-grid">{filteredRooms.length ? filteredRooms.map((room) => <RoomTile key={room.number} room={room} onClick={() => onRoomClick(room)} />) : <p className="empty-state">No rooms match that search. Try another room number or name.</p>}</div>
              </section>
              {activeNav === 'Overview' && <div className="dash-bottom-grid">
                <section className="panel arrivals-panel"><div className="panel-heading"><div><h2>Coming & going</h2><p>Today, November 19</p></div><button className="underlined-link" onClick={() => setActiveNav('Bookings')}>All bookings <ArrowRight size={14} /></button></div><div className="arrival-list">
                  {[{ time: '10:00', meridian: 'AM', name: 'Ishaan Rao', action: 'Check-out', room: 'Room 201', kind: 'out', color: 'sage' }, { time: '11:00', meridian: 'AM', name: 'Aarav Mehta', action: 'Check-out', room: 'Room 101', kind: 'out', color: 'gold' }, { time: '2:00', meridian: 'PM', name: 'Kavya & Nikhil', action: 'Check-in', room: 'Room 102', kind: 'in', color: 'clay' }].map((item) => <div className="arrival-row" key={item.name}><span className="arrival-time">{item.time}<small>{item.meridian}</small></span><span className={`arrival-avatar ${item.color}`}>{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="arrival-person"><strong>{item.name}</strong><small>{item.action} · {item.room}</small></span><span className={`arrival-pill ${item.kind}`}>{item.action}</span></div>)}
                </div></section>
                <section className="panel occupancy-panel"><div className="panel-heading"><div><h2>A good week, so far.</h2><p>Room occupancy · past seven days</p></div><button className="select-small">This week <ChevronDown size={13} /></button></div><div className="chart-area"><div className="chart-y-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart-bars">{[{ day: 'T', value: 55 }, { day: 'F', value: 70 }, { day: 'S', value: 62 }, { day: 'S', value: 88 }, { day: 'M', value: 76 }, { day: 'T', value: 92 }, { day: 'W', value: 72 }].map((item, index) => <div className="chart-bar-col" key={`${item.day}-${index}`}><div className={`chart-bar ${index === 6 ? 'today' : ''}`} style={{ height: `${item.value}%` }} title={`${item.value}%`} /><span>{item.day}</span></div>)}</div></div><div className="chart-summary"><span><i /> This week</span><strong>72% <small><ArrowUpRight size={13} /> 8.4%</small></strong></div></section>
              </div>}
            </>
          ) : activeNav === 'Bookings' || activeNav === 'Guests' || activeNav === 'My stays' ? <BookingsView bookings={bookings} onNewBooking={onNewBooking} onUpdateBooking={onUpdateBooking} onGuestNote={onGuestNote} isGuest={role === 'guest'} guestEmail={guestEmail} /> :
            activeNav === 'Revenue' ? <RevenueView onExport={onExportRevenue} /> :
              activeNav === 'Expenses' ? <ExpensesView csrfToken={csrfToken} onToast={onToast} /> :
                activeNav === 'Team & access' ? <TeamView csrfToken={csrfToken} currentUserEmail={currentUserEmail} onToast={onToast} /> :
                  <RoomsSettings rooms={rooms} roomTypes={roomTypes} canCreateRooms={canCreateRooms} onCreateRoom={onCreateRoom} onRoomStatus={onRoomStatus} onNewBooking={onNewBooking} />}
        </div>
      </main>
      {modal && <Modal type={modal.type} roomType={modal.roomType} room={modal.room} onClose={onCloseModal} onLogin={onLogin} onBooking={onBooking} onRoomStatus={onRoomStatus} onRoomBooking={onRoomBooking} />}
      <AccessibilityWidget />
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  )
}

function MetricCard({ label, value, trend, positive, note, icon: Icon }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={16} /></div><div className="metric-value">{value}</div><div className="metric-foot"><span className={positive ? 'trend up' : 'trend'}>{positive && <ArrowUpRight size={12} />}{trend}</span><span>{note}</span></div></article>
}

function RoomTile({ room, onClick }) {
  const initials = room.guest ? room.guest.split(' ').map((part) => part[0]).slice(0, 2).join('') : ''
  return <button className={`room-tile ${room.status}`} onClick={onClick}><span className="room-tile-top"><strong>{room.number}</strong><span className="room-status"><i />{statusNames[room.status]}</span></span><span className="room-tile-type">{room.type}</span>{room.guest ? <span className="room-guest"><span className="guest-initials">{initials}</span>{room.guest}</span> : <span className="room-note">{room.until || (room.status === 'available' ? 'Ready for a guest' : '')}</span>}<span className="room-tile-bottom">{room.status === 'occupied' ? `Until ${room.until}` : room.status === 'available' ? `₹${room.price.toLocaleString('en-IN')} / night` : room.status === 'cleaning' ? 'Housekeeping in progress' : 'Being looked after'}<ChevronRight size={14} /></span></button>
}

function BookingsView({ bookings, onNewBooking, onUpdateBooking, onGuestNote, isGuest = false, guestEmail }) {
  const [nextStatus, setNextStatus] = useState({})
  const [nextRemarks, setNextRemarks] = useState({})
  const [guestMessages, setGuestMessages] = useState({})
  const guestBookings = bookings.filter((booking) => (
    (booking.email || booking.guest_email || '').toLowerCase() === guestEmail?.toLowerCase()
  ))
  const demoBookings = DEMO_MODE ? [
    { id: 'SR-240118', name: 'Kavya & Nikhil', roomType: 'Garden Suite', roomNumber: '102', checkIn: 'Nov 19, 2026', checkOut: 'Nov 22, 2026', total: 19200, source: 'Direct', status: 'Confirmed', statusValue: 'confirmed' },
    { id: 'SR-240116', name: 'Maya Shah', roomType: 'Courtyard Twin', roomNumber: '104', checkIn: 'Nov 17, 2026', checkOut: 'Nov 20, 2026', total: 15600, source: 'Booking.com', status: 'Checked in', statusValue: 'checked_in' },
    { id: 'SR-240111', name: 'Ishaan Rao', roomType: 'Palm Residence', roomNumber: '201', checkIn: 'Nov 16, 2026', checkOut: 'Nov 19, 2026', total: 24600, source: 'Walk-in', status: 'Checked out', statusValue: 'checked_out' },
  ] : []
  const rows = isGuest ? guestBookings : [...bookings, ...demoBookings]
  const statusOptions = [
    ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['checked_in', 'Checked in'],
    ['checked_out', 'Checked out'], ['cancelled', 'Cancelled'], ['no_show', 'No show'],
  ]
  return (
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>{isGuest ? 'Your stays, all in one place.' : 'Bookings, made simple.'}</h2><p>{isGuest ? 'Your upcoming and past stays at Serein House.' : 'Reservations and guest stays in one place.'}</p></div>{!isGuest && <button className="button button-green" onClick={onNewBooking}><Plus size={16} /> Add booking</button>}</div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>BOOKING</th><th>GUEST</th><th>ROOM</th><th>STAY</th><th>SOURCE</th><th>AMOUNT</th><th>STATUS</th>{isGuest ? <><th>LATEST NOTE</th><th>MESSAGE THE TEAM</th></> : <th>ACTIONS</th>}</tr></thead>
          <tbody>{rows.map((booking) => {
            const id = booking.id || booking.booking_reference
            const value = nextStatus[id] || booking.statusValue || (booking.status || '').toLowerCase().replaceAll(' ', '_')
            const label = statusOptions.find(([option]) => option === value)?.[1] || booking.status
            return <tr key={id}>
              <td className="booking-ref">{id}</td>
              <td>{booking.name || booking.guest_name}</td>
              <td>{booking.roomType || booking.room_type || 'Garden Suite'}{(booking.roomNumber || booking.room_number) && <small className="table-secondary">Room {booking.roomNumber || booking.room_number}</small>}</td>
              <td>{booking.checkIn || booking.check_in} – {booking.checkOut || booking.check_out}</td>
              <td><span className="source-tag">{booking.source || 'Direct'}</span></td>
              <td>₹{Number(booking.total || booking.total_amount || 0).toLocaleString('en-IN')}</td>
              <td><span className={`booking-status ${value.replaceAll('_', '-')}`}>{label}</span></td>
              {isGuest
                ? <><td className="guest-note-cell">{booking.latest_guest_note || 'No messages yet'}</td><td><div className="guest-message-actions"><input aria-label={`Message team for ${id}`} placeholder="Write a note..." value={guestMessages[id] || ''} onChange={(event) => setGuestMessages((current) => ({ ...current, [id]: event.target.value }))} /><button className="text-button" disabled={!guestMessages[id]?.trim()} onClick={async () => { const sent = await onGuestNote(booking, guestMessages[id].trim()); if (sent) setGuestMessages((current) => ({ ...current, [id]: '' })) }}>Send</button></div></td></>
                : <td><div className="booking-actions"><select aria-label={`Booking status ${id}`} value={value} onChange={(event) => setNextStatus((current) => ({ ...current, [id]: event.target.value }))}>{statusOptions.map(([option, optionLabel]) => <option key={option} value={option}>{optionLabel}</option>)}</select><input aria-label={`Staff remarks ${id}`} placeholder="Add a note" defaultValue={booking.staff_remarks || ''} onChange={(event) => setNextRemarks((current) => ({ ...current, [id]: event.target.value }))} /><button className="text-button" disabled={!DEMO_MODE && (!Number.isSafeInteger(Number(booking.databaseId)) || Number(booking.databaseId) < 1)} title={!DEMO_MODE && (!Number.isSafeInteger(Number(booking.databaseId)) || Number(booking.databaseId) < 1) ? 'This booking has no database ID and cannot be updated.' : undefined} onClick={() => onUpdateBooking(booking, value, nextRemarks[id] ?? booking.staff_remarks ?? '')}>Save</button></div></td>}
            </tr>
          })}</tbody>
        </table>
        {rows.length === 0 && <p className="empty-state">You don’t have any stays yet. We’d love to welcome you.</p>}
      </div>
    </section>
  )
}

function RevenueView({ onExport }) {
  const [period, setPeriod] = useState('This month')
  const [channel, setChannel] = useState('all')
  const [from, setFrom] = useState(`${dateToday.slice(0, 7)}-01`)
  const [to, setTo] = useState(dateToday)
  const channels = [['all', 'All channels'], ['cash', 'Cash'], ['online', 'Online'], ['pending', 'Pending'], ['ota', 'OTA'], ['walk_in', 'Walk-in']]
  return <><div className="revenue-toolbar"><div className="period-tabs">{['Today', 'Yesterday', 'This week', 'This month', 'This year'].map((item) => <button className={period === item ? 'active' : ''} key={item} onClick={() => setPeriod(item)}>{item}</button>)}</div><div className="revenue-controls"><label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To <input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="outline-button" onClick={() => setPeriod('Custom range')}>Apply</button><button className="outline-button" onClick={() => onExport(from, to, channel)}><Download size={15} /> Export CSV</button></div></div><div className="period-tabs channel-tabs">{channels.map(([value, label]) => <button key={value} className={channel === value ? 'active' : ''} onClick={() => setChannel(value)}>{label}</button>)}</div><div className="metrics-grid revenue-metrics"><MetricCard label="TOTAL REVENUE" value="₹8,42,600" trend="12.8%" positive note="vs. previous period" icon={ArrowUpRight} /><MetricCard label="PAID ONLINE" value="₹4,18,200" trend="49.6%" positive note="of total revenue" icon={ArrowUpRight} /><MetricCard label="CASH COLLECTED" value="₹2,96,400" trend="35.2%" positive note="of total revenue" icon={ArrowUpRight} /><MetricCard label="PAYMENTS PENDING" value="₹1,28,000" trend="15.2%" positive={false} note="across 6 bookings" icon={Clock3} /></div><section className="panel revenue-chart-panel"><div className="panel-heading"><div><h2>Revenue over time</h2><p>Daily revenue · {period.toLowerCase()} · {channels.find(([value]) => value === channel)?.[1]}</p></div><span className="chart-legend"><i /> Revenue</span></div><div className="revenue-bars">{[48, 62, 42, 78, 60, 90, 53, 69, 82, 57, 98, 75, 63, 86].map((height, index) => <div key={index}><span className="revenue-bar" style={{ height: `${height}%` }} /><small>{index % 2 === 0 ? `${index + 1}` : ''}</small></div>)}</div></section></>
}

function ExpensesView({ csrfToken, onToast }) {
  const demoCategories = [
    'Salaries', 'Laundry', 'Internet & utilities', 'Repairs & breakages',
    'Food & beverage', 'Housekeeping supplies', 'Marketing', 'Other',
  ].map((name) => ({ id: name, name }))
  const [items, setItems] = useState(() => DEMO_MODE ? readDemoList('serein-expenses', [
    { date: 'Nov 18, 2026', category: 'Laundry', note: 'Weekly linen service', amount: 8400, method: 'Bank transfer' },
    { date: 'Nov 17, 2026', category: 'Staff salaries', note: 'Housekeeping team · November', amount: 68000, method: 'Bank transfer' },
    { date: 'Nov 15, 2026', category: 'Repairs & maintenance', note: 'Room 106 air-conditioning', amount: 4200, method: 'Cash' },
  ]) : [])
  const [categories, setCategories] = useState(() => DEMO_MODE ? demoCategories : [])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (DEMO_MODE) localStorage.setItem('serein-expenses', JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let active = true
    apiRequest('/expenses')
      .then((result) => {
        if (!active) return
        setItems(result.expenses.map((item) => ({
          ...item,
          date: item.expense_date,
          category: item.category,
          note: item.description,
          method: titleCase(item.payment_method),
          amount: Number(item.amount),
        })))
        setCategories(result.categories)
      })
      .catch((requestError) => { if (active) onToast(requestError.message) })
    return () => { active = false }
  }, [onToast])

  async function submitExpense(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const category = categories.find((item) => String(item.id) === data.get('category'))
    const amount = Number(data.get('amount'))
    const description = String(data.get('description')).trim()
    if (!category || !Number.isFinite(amount) || amount <= 0 || !description) {
      setError('Choose a category and enter a positive amount and description.')
      return
    }
    setError('')
    if (!DEMO_MODE) {
      try {
        await apiRequest('/expenses', {
          method: 'POST',
          csrfToken,
          body: {
            category_id: Number(category.id),
            amount,
            expense_date: data.get('date'),
            payment_method: data.get('method'),
            vendor: data.get('vendor'),
            description,
          },
        })
        const result = await apiRequest('/expenses')
        setItems(result.expenses.map((item) => ({ ...item, date: item.expense_date, category: item.category, note: item.description, method: titleCase(item.payment_method), amount: Number(item.amount) })))
        setCategories(result.categories)
        onToast('Expense saved.')
      } catch (requestError) {
        setError(requestError.message)
        return
      }
    } else {
      const date = data.get('date')
      const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      setItems((current) => [{ date: dateLabel, category: category.name, note: description, amount, method: titleCase(data.get('method')), vendor: data.get('vendor') }, ...current])
      onToast('Demo expense saved on this browser.')
    }
    form.reset()
    setShowForm(false)
  }

  return <section className="panel table-panel">
    <div className="panel-heading"><div><h2>The little things, accounted for.</h2><p>Track spending so the whole picture stays clear.</p></div><button className="button button-green" onClick={() => { setShowForm((value) => !value); setError('') }}><Plus size={16} /> {showForm ? 'Close form' : 'Add expense'}</button></div>
    {showForm && <form className="expense-form" onSubmit={submitExpense}>
      <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label>
      <label>Date<input name="date" type="date" required defaultValue={dateToday} /></label>
      <label>Payment method<select name="method"><option value="cash">Cash</option><option value="online">Online</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label>
      <label>Vendor <span className="optional">(optional)</span><input name="vendor" placeholder="Who was paid?" /></label>
      <label>Description<input name="description" required maxLength="500" placeholder="What was this expense for?" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-green" type="submit">Save expense <Check size={15} /></button>
    </form>}
    <div className="table-scroll"><table><thead><tr><th>DATE</th><th>CATEGORY</th><th>DESCRIPTION</th><th>PAYMENT METHOD</th><th>AMOUNT</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.id || item.date}-${index}`}><td>{item.date}</td><td><span className="source-tag">{item.category}</span></td><td>{item.note}</td><td>{item.method}</td><td>₹{item.amount.toLocaleString('en-IN')}</td></tr>)}</tbody></table>{items.length === 0 && <p className="empty-state">No expenses recorded for this property yet.</p>}</div>
  </section>
}

function TeamView({ csrfToken, currentUserEmail, onToast }) {
  const demoPermissionList = [
    ['dashboard.view', 'View dashboard', 'dashboard'], ['rooms.view', 'View rooms', 'rooms'],
    ['rooms.create', 'Create rooms and room types', 'rooms'], ['rooms.update', 'Update room details and readiness', 'rooms'],
    ['bookings.view', 'View bookings', 'bookings'], ['bookings.create', 'Create bookings', 'bookings'],
    ['bookings.update', 'Edit bookings and remarks', 'bookings'], ['bookings.delete', 'Cancel bookings', 'bookings'],
    ['guests.view', 'View guest details', 'guests'], ['guests.message', 'Communicate with guests', 'guests'],
    ['revenue.view', 'View revenue and reports', 'revenue'], ['expenses.manage', 'Manage expenses', 'expenses'],
    ['users.view', 'View team and access', 'users'], ['users.create', 'Create team members', 'users'],
    ['users.update', 'Update users and access', 'users'], ['settings.manage', 'Manage hotel settings', 'settings'],
    ['audit.view', 'View activity history', 'audit'],
  ].map(([permission_key, label, module], index) => ({ id: `permission-${index}`, permission_key, label, module }))
  const demoTeamSeed = [
    { id: 'demo-1', name: 'Aarav Shah', email: 'aarav@sereinhouse.in', role: 'super_admin', is_active: true },
    { id: 'demo-2', name: 'Priya Naik', email: 'priya@sereinhouse.in', role: 'receptionist', is_active: true },
    { id: 'demo-3', name: 'Vikram Sawant', email: 'vikram@sereinhouse.in', role: 'housekeeping', is_active: true },
    { id: 'demo-4', name: 'Meera Rao', email: 'meera@sereinhouse.in', role: 'receptionist', is_active: false },
  ]
  const demoRoleSeed = [
    { id: 'super_admin', name: 'super_admin', is_system: true, permission_keys: demoPermissionList.map((permission) => permission.permission_key) },
    { id: 'admin', name: 'admin', is_system: true, permission_keys: demoPermissionList.map((permission) => permission.permission_key) },
    { id: 'receptionist', name: 'receptionist', is_system: true, permission_keys: demoPermissionList.slice(0, 2).concat(demoPermissionList.slice(4, 10)).map((permission) => permission.permission_key) },
    { id: 'housekeeping', name: 'housekeeping', is_system: true, permission_keys: ['dashboard.view', 'rooms.view', 'rooms.update', 'guests.message'] },
    { id: 'guest', name: 'guest', is_system: true, permission_keys: ['bookings.view', 'bookings.create', 'guests.message'] },
  ]
  const [team, setTeam] = useState(() => DEMO_MODE ? readDemoList('serein-team', demoTeamSeed) : [])
  const [roles, setRoles] = useState(() => DEMO_MODE ? readDemoList('serein-roles', demoRoleSeed) : [])
  const [permissions, setPermissions] = useState(() => DEMO_MODE ? demoPermissionList : [])
  const [selectedRoleId, setSelectedRoleId] = useState(() => DEMO_MODE ? 'super_admin' : '')
  const [draftPermissions, setDraftPermissions] = useState(() => roles.find((item) => item.name === 'super_admin')?.permission_keys || [])
  const [showForm, setShowForm] = useState(false)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [error, setError] = useState('')
  const selectedRole = roles.find((item) => String(item.id) === String(selectedRoleId)) || roles[0]

  useEffect(() => {
    if (DEMO_MODE) localStorage.setItem('serein-team', JSON.stringify(team))
  }, [team])

  useEffect(() => {
    if (DEMO_MODE) localStorage.setItem('serein-roles', JSON.stringify(roles))
  }, [roles])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let active = true
    Promise.all([apiRequest('/users'), apiRequest('/roles')])
      .then(([userResult, roleResult]) => {
        if (!active) return
        setTeam(userResult.users)
        setRoles(roleResult.roles)
        setPermissions(roleResult.permissions)
        setSelectedRoleId(String(roleResult.roles[0]?.id || ''))
        setDraftPermissions(roleResult.roles[0]?.permission_keys || [])
      })
      .catch((requestError) => { if (active) onToast(requestError.message) })
    return () => { active = false }
  }, [onToast])

  async function submitMember(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name')).trim()
    const email = String(data.get('email')).trim()
    const role = roles.find((item) => String(item.id) === data.get('role'))
    const password = String(data.get('password'))
    if (!name || !email || !role || password.length < 12) {
      setError('Enter a name, valid email, role, and a password of at least 12 characters.')
      return
    }
    setError('')
    try {
      if (!DEMO_MODE) {
        await apiRequest('/users', { method: 'POST', csrfToken, body: { name, email, role_id: Number(role.id), password, phone: data.get('phone') } })
        const result = await apiRequest('/users')
        setTeam(result.users)
        onToast('Team member created.')
      } else {
        setTeam((current) => [...current, { id: `demo-${Date.now()}`, name, email, role: role.name, is_active: true }])
        onToast('Demo teammate added on this browser.')
      }
      form.reset()
      setShowForm(false)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function updateMember(member, change) {
    try {
      if (!DEMO_MODE) {
        await apiRequest(`/users/${member.id}`, { method: 'PATCH', csrfToken, body: change })
      }
      setTeam((current) => current.map((item) => item.id === member.id ? { ...item, ...(change.role_id ? { role: roles.find((role) => String(role.id) === String(change.role_id))?.name || item.role } : {}), ...(Object.prototype.hasOwnProperty.call(change, 'is_active') ? { is_active: change.is_active } : {}) } : item))
    } catch (requestError) {
      onToast(requestError.message)
    }
  }

  async function submitRole(event) {
    event.preventDefault()
    if (!selectedRole || selectedRole.name === 'super_admin') return
    try {
      if (!DEMO_MODE) {
        await apiRequest(`/roles/${selectedRole.id}/permissions`, {
          method: 'PATCH',
          csrfToken,
          body: { permission_ids: permissions.filter((permission) => draftPermissions.includes(permission.permission_key)).map((permission) => Number(permission.id)) },
        })
      }
      setRoles((current) => current.map((role) => String(role.id) === String(selectedRole.id) ? { ...role, permission_keys: draftPermissions } : role))
      onToast('Role permissions saved.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function createRole(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name')).trim().toLowerCase().replaceAll(' ', '_')
    if (!/^[a-z][a-z0-9_]{2,59}$/.test(name)) {
      setError('Use at least three lowercase letters, numbers, or underscores for the role name.')
      return
    }
    try {
      let role
      if (!DEMO_MODE) {
        const result = await apiRequest('/roles', { method: 'POST', csrfToken, body: { name, description: data.get('description'), permission_ids: [] } })
        const resultRoles = await apiRequest('/roles')
        setRoles(resultRoles.roles)
        setPermissions(resultRoles.permissions)
        role = resultRoles.roles.find((item) => Number(item.id) === Number(result.id))
      } else {
        role = { id: `demo-role-${Date.now()}`, name, description: data.get('description'), is_system: false, permission_keys: [] }
        setRoles((current) => [...current, role])
      }
      if (role) {
        setSelectedRoleId(String(role.id))
        setDraftPermissions(role.permission_keys || [])
      }
      form.reset()
      setShowRoleForm(false)
      setError('')
      onToast('Role created. Select its permissions below.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return <section className="panel table-panel">
    <div className="panel-heading"><div><h2>Good people, clear permissions.</h2><p>Give every person just the access they need.</p></div><button className="button button-green" onClick={() => { setShowForm((value) => !value); setError('') }}><Plus size={16} /> {showForm ? 'Close form' : 'Add team member'}</button></div>
    {showForm && <form className="expense-form team-form" onSubmit={submitMember}>
      <label>Full name<input name="name" required maxLength="120" placeholder="Team member name" /></label>
      <label>Email address<input name="email" type="email" required placeholder="name@example.com" /></label>
      <label>Role<select name="role" required defaultValue=""><option value="" disabled>Choose a role</option>{roles.map((role) => <option key={role.id} value={role.id}>{titleCase(role.name)}</option>)}</select></label>
      <label>Temporary password<input name="password" type="password" required minLength="12" autoComplete="new-password" placeholder="At least 12 characters" /></label>
      <label>Phone <span className="optional">(required for guest accounts)</span><input name="phone" type="tel" maxLength="30" placeholder="Phone number" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-green" type="submit">Create account <Check size={15} /></button>
    </form>}
    <div className="table-scroll"><table><thead><tr><th>TEAM MEMBER</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{team.map((member) => <tr key={member.id}>
      <td><span className="team-cell"><span className="avatar">{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>{member.name}</span></td>
      <td>{member.email}</td>
      <td><select className="role-select" aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => {
        const role = roles.find((item) => item.name === event.target.value)
        if (role) updateMember(member, DEMO_MODE ? { role_id: role.id } : { role_id: Number(role.id) })
      }}>{roles.map((role) => <option key={role.id} value={role.name}>{titleCase(role.name)}</option>)}</select></td>
      <td><span className={`booking-status ${member.is_active ? 'confirmed' : 'cancelled'}`}>{member.is_active ? 'Active' : 'Deactivated'}</span></td>
      <td><button className="text-button" disabled={member.email === currentUserEmail} onClick={() => updateMember(member, { is_active: !member.is_active })}>{member.is_active ? 'Deactivate' : 'Reactivate'}</button></td>
    </tr>)}</tbody></table>{team.length === 0 && <p className="empty-state">No team accounts found.</p>}</div>
    <div className="access-management">
      <div className="panel-heading access-heading"><div><h2>Role permissions</h2><p>Choose which hotel modules each role can access.</p></div><button className="text-button" onClick={() => { setShowRoleForm((value) => !value); setError('') }}>{showRoleForm ? 'Cancel' : 'Create role'}</button></div>
      {showRoleForm && <form className="expense-form team-form role-create-form" onSubmit={createRole}>
        <label>Role name<input name="name" required maxLength="60" placeholder="e.g. night_manager" /></label>
        <label>Description<input name="description" maxLength="255" placeholder="What this role is responsible for" /></label>
        <button className="button button-green" type="submit">Create role <Check size={15} /></button>
      </form>}
      {roles.length > 0 && <form className="permission-form" onSubmit={submitRole}>
        <label className="permission-role-label">Edit permissions for<select value={selectedRole?.id || ''} onChange={(event) => {
          const role = roles.find((item) => String(item.id) === event.target.value)
          setSelectedRoleId(event.target.value)
          setDraftPermissions(role?.permission_keys || [])
          setError('')
        }}>{roles.map((role) => <option key={role.id} value={role.id}>{titleCase(role.name)}</option>)}</select></label>
        {selectedRole?.name === 'super_admin' && <p className="permission-note">The built-in super administrator role always has full access and cannot be changed.</p>}
        <div className="permission-grid">{permissions.map((permission) => {
          const ownRole = team.find((member) => member.email === currentUserEmail)?.role === selectedRole?.name
          const protectedPermission = ownRole && permission.permission_key === 'settings.manage'
          return <label className="permission-option" key={permission.id}><input type="checkbox" checked={draftPermissions.includes(permission.permission_key)} disabled={selectedRole?.name === 'super_admin' || protectedPermission} onChange={(event) => setDraftPermissions((current) => event.target.checked ? [...current, permission.permission_key] : current.filter((key) => key !== permission.permission_key))} /><span><strong>{permission.label}</strong><small>{permission.module}</small></span></label>
        })}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-green" type="submit" disabled={!selectedRole || selectedRole.name === 'super_admin'}>Save role permissions <Check size={15} /></button>
      </form>}
    </div>
  </section>
}

function RoomsSettings({ rooms, roomTypes, canCreateRooms, onCreateRoom, onRoomStatus, onNewBooking }) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  async function submitRoom(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const roomNumber = String(data.get('room_number')).trim()
    if (!roomNumber || rooms.some((room) => room.number.toLowerCase() === roomNumber.toLowerCase())) {
      setError(roomNumber ? `Room ${roomNumber} already appears in the room list. Use a unique number.` : 'Enter a room number.')
      return
    }
    setError('')
    try {
      await onCreateRoom({
        room_number: roomNumber,
        room_type_id: data.get('room_type_id'),
        floor: String(data.get('floor')).trim(),
        bed_configuration: String(data.get('bed_configuration')).trim(),
        status: data.get('status'),
        has_wifi: data.has('has_wifi'),
        has_ac: data.has('has_ac'),
        has_fridge: data.has('has_fridge'),
        has_balcony: data.has('has_balcony'),
      })
      form.reset()
      setShowForm(false)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return <section className="panel table-panel">
    <div className="panel-heading"><div><h2>Every room, thoughtfully cared for.</h2><p>Update room readiness or welcome a new guest.</p></div><div className="room-settings-actions">{canCreateRooms && <button className="outline-button" onClick={() => { setShowForm((value) => !value); setError('') }}><Plus size={15} /> {showForm ? 'Close form' : 'Add a room'}</button>}<button className="button button-green" onClick={onNewBooking}><Plus size={16} /> New booking</button></div></div>
    {showForm && <form className="room-create-form" onSubmit={submitRoom}>
      <label>Room number<input name="room_number" required maxLength="20" placeholder="e.g. 101" /></label>
      <label>Room type<select name="room_type_id" required defaultValue=""><option value="" disabled>Choose room type</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name} · ₹{Number(type.base_price).toLocaleString('en-IN')} / night</option>)}</select></label>
      <label>Floor <span className="optional">(optional)</span><input name="floor" maxLength="30" placeholder="e.g. Ground floor" /></label>
      <label>Bed configuration <span className="optional">(optional)</span><input name="bed_configuration" maxLength="80" placeholder="e.g. King bed" /></label>
      <label>Initial status<select name="status" defaultValue="available"><option value="available">Available for bookings</option><option value="cleaning">Being cleaned</option><option value="maintenance">Under maintenance</option></select></label>
      <fieldset className="room-amenity-options"><legend>In-room amenities</legend><label><input type="checkbox" name="has_wifi" defaultChecked /> Wi-Fi</label><label><input type="checkbox" name="has_ac" defaultChecked /> Air conditioning</label><label><input type="checkbox" name="has_fridge" /> Fridge</label><label><input type="checkbox" name="has_balcony" /> Balcony</label></fieldset>
      {roomTypes.length === 0 && <p className="form-error" role="alert">No active room types are configured. Ask the administrator to add room types first.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-green" type="submit" disabled={!roomTypes.length}>Save room <Check size={15} /></button>
    </form>}
    <div className="room-settings-grid">{rooms.map((room) => <article key={room.number} className="room-setting"><div><strong>Room {room.number}</strong><small>{room.type} · ₹{room.price.toLocaleString('en-IN')} / night</small></div><select aria-label={`Room ${room.number} status`} value={room.status} onChange={(event) => onRoomStatus(room.number, event.target.value)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="cleaning">Cleaning</option><option value="maintenance">Maintenance</option></select></article>)}{rooms.length === 0 && <p className="empty-state">No rooms have been added yet. Add your real room numbers and types to make them bookable.</p>}</div>
  </section>
}

function Modal({ type, roomType, room, checkIn, checkOut, guests, onClose, onLogin, onBooking, onRoomStatus, onRoomBooking }) {
  const [error, setError] = useState('')
  const isBooking = type === 'booking'
  const isRoom = type === 'room'
  const [roomStatus, setRoomStatus] = useState(room?.status || 'available')

  async function submitLogin(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    try {
      await onLogin({ name: data.get('name') || 'Aarav Shah', email: data.get('email'), password: data.get('password'), role: data.get('role') })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function submitBooking(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const checkIn = data.get('checkIn')
    const checkOut = data.get('checkOut')
    if (!checkIn || !checkOut || checkOut <= checkIn) { setError('Please choose a check-out date after your check-in date.'); return }
    const roomNumber = room?.number || null
    setError('')
    try {
      await onBooking({ name: data.get('name'), email: data.get('email'), phone: data.get('phone'), checkIn, checkOut, roomType: room?.type || roomType || data.get('roomType') || 'Garden Suite', roomId: room?.id || null, roomNumber, source: 'Direct', adults: Number(data.get('adults') || guests || 2), total: (room?.price || 6400) * Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000)), remarks: data.get('remarks') })
    } catch (requestError) {
      setError(bookingErrorMessage(requestError.message, room))
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`modal-card ${isBooking ? 'booking-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-heading"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>{isRoom ? <>
    <p className="eyebrow">A LITTLE LOOK AROUND</p><h2 id="modal-heading">Room {room.number}</h2><p className="modal-description">{room.type} · ₹{room.price.toLocaleString('en-IN')} per night</p>
    <div className="room-modal-details"><span><i className={`legend-dot ${room.status}`} /> {statusNames[room.status]}</span>{room.guest && <span>Guest · {room.guest}</span>}{room.until && <span>{room.until}</span>}</div>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onRoomStatus(room.number, roomStatus) }}><label>Room status<select value={roomStatus} onChange={(event) => setRoomStatus(event.target.value)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="cleaning">Cleaning</option><option value="maintenance">Maintenance</option></select></label><button className="button button-green modal-submit" type="submit">Save room status <Check size={16} /></button><button className="outline-button" type="button" onClick={() => onRoomBooking(room)}>Create a booking for this room <ArrowRight size={14} /></button></form>
  </> : isBooking ? <>
    <p className="eyebrow">A GOOD PLACE TO BEGIN</p><h2 id="modal-heading">Let’s make room for you.</h2><p className="modal-description">Tell us a little about your stay and our team will take it from here.</p>
    <form className="modal-form" onSubmit={submitBooking}><label>Room to stay in<select name="roomType" defaultValue={room?.type || roomType || 'Garden Suite'} disabled={Boolean(room)}><option>Garden Suite</option><option>Deluxe King</option><option>Courtyard Twin</option><option>Palm Residence</option></select>{room && <span className="optional">Room {room.number} selected</span>}</label><div className="form-two-col"><label>Check in<input required type="date" name="checkIn" min={dateToday} defaultValue={checkIn || dateToday} /></label><label>Check out<input required type="date" name="checkOut" min={checkIn || dateToday} defaultValue={checkOut || dateAfterTwoNights} /></label></div><label>Guests<select name="adults" defaultValue={guests || '2'}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option></select></label><div className="form-two-col"><label>Your name<input required name="name" placeholder="Full name" autoComplete="name" /></label><label>Email address<input required type="email" name="email" placeholder="you@example.com" autoComplete="email" /></label></div><label>Phone number<input required type="tel" name="phone" placeholder="+91 98765 43210" autoComplete="tel" /></label><label>A note for us <span className="optional">(optional)</span><textarea name="remarks" rows="2" placeholder="An early check-in? A little birthday surprise?" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-green modal-submit" type="submit">Request your stay <ArrowRight size={16} /></button><p className="privacy-note">No payment needed now. Our team will be in touch to confirm.</p></form>
  </> : <><p className="eyebrow">THE HOUSE, BEHIND THE HOUSE</p><h2 id="modal-heading">A warm welcome back.</h2><p className="modal-description">Sign in to look after the little details.</p><form className="modal-form" onSubmit={submitLogin}><label>Your name<input name="name" placeholder="Your name" /></label><label>Work email<input required type="email" name="email" placeholder="you@sereinhouse.in" /></label><label>Password<input required type="password" name="password" placeholder="Enter your password" minLength="4" /></label>{DEMO_MODE && <label>Your role<select name="role"><option value="reception">Receptionist</option><option value="owner">Property owner / Admin</option><option value="housekeeping">Housekeeping</option><option value="guest">Guest</option></select></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-green modal-submit" type="submit">Sign in to the house <ArrowRight size={16} /></button><p className="privacy-note">{DEMO_MODE ? 'Demo access is enabled. Any email and password will open a preview workspace.' : 'Your access and permissions are managed by the hotel.'}</p></form></>}</section></div>
}

function AccessibilityWidget() {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState(0)
  const [highContrast, setHighContrast] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('large-type', size > 0)
    document.documentElement.classList.toggle('small-type', size < 0)
    document.body.classList.toggle('high-contrast', highContrast)
    return () => {
      document.documentElement.classList.remove('large-type', 'small-type')
      document.body.classList.remove('high-contrast')
    }
  }, [size, highContrast])
  return <div className="accessibility"><button className="accessibility-toggle" onClick={() => setOpen(!open)} aria-label="Accessibility settings"><span aria-hidden="true">◉</span></button>{open && <div className="accessibility-panel"><strong>Make yourself at home</strong><button disabled={size >= 1} onClick={() => setSize((value) => value + 1)}>Make text larger</button><button disabled={size <= -1} onClick={() => setSize((value) => value - 1)}>Make text smaller</button><button onClick={() => setHighContrast((value) => !value)}>{highContrast ? 'Use regular contrast' : 'Increase contrast'}</button><small>Every control works without audio; images include text descriptions.</small><button onClick={() => setOpen(false)}>Close</button></div>}</div>
}

export default App
