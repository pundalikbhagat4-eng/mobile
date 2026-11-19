import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';

const initialRooms = [
  { number: '101', type: 'Garden Suite', status: 'occupied', guest: 'Aarav Mehta', rate: '₹6,400' },
  { number: '102', type: 'Deluxe King', status: 'available', guest: '', rate: '₹4,800' },
  { number: '103', type: 'Garden Suite', status: 'cleaning', guest: '', rate: '₹6,400' },
  { number: '104', type: 'Courtyard Twin', status: 'occupied', guest: 'Maya Shah', rate: '₹5,200' },
  { number: '105', type: 'Deluxe King', status: 'available', guest: '', rate: '₹4,800' },
  { number: '106', type: 'Palm Residence', status: 'maintenance', guest: '', rate: '₹8,200' },
  { number: '201', type: 'Palm Residence', status: 'occupied', guest: 'Ishaan Rao', rate: '₹8,200' },
  { number: '202', type: 'Deluxe King', status: 'available', guest: '', rate: '₹4,800' },
];

const labels = {
  available: 'Ready',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
};

export default function App() {
  const [rooms, setRooms] = useState(initialRooms);
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const visibleRooms = useMemo(
    () => rooms.filter((room) => filter === 'all' || room.status === filter),
    [filter, rooms],
  );
  const readyCount = rooms.filter((room) => room.status === 'available').length;
  const arrivalCount = rooms.filter((room) => room.status === 'occupied').length;

  function markReady(room) {
    if (room.status !== 'cleaning') return;
    setRooms((current) => current.map((item) => (
      item.number === room.number ? { ...item, status: 'available' } : item
    )));
    setNotice(`Room ${room.number} is ready for its next guest.`);
    setTimeout(() => setNotice(''), 2800);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandIcon}><Text style={styles.brandLeaf}>✳</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>serein<Text style={styles.brandHouse}>house</Text></Text>
            <Text style={styles.brandCaption}>THE HOUSE, BEHIND THE HOUSE</Text>
          </View>
          <View style={styles.userBadge}><Text style={styles.userInitials}>PS</Text></View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>WEDNESDAY · NOVEMBER 19, 2026</Text>
          <Text style={styles.title}>Good morning, Priya.</Text>
          <Text style={styles.subtitle}>A little overview of the house, right now.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ROOMS READY</Text>
            <Text style={styles.summaryValue}>{readyCount}<Text style={styles.summaryTotal}> / {rooms.length}</Text></Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>GUESTS IN HOUSE</Text>
            <Text style={styles.summaryValue}>{arrivalCount}</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Rooms at a glance</Text>
            <Text style={styles.sectionCopy}>Tap a room to mark it ready.</Text>
          </View>
          <Text style={styles.roomCount}>{rooms.length} ROOMS</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {['all', 'available', 'occupied', 'cleaning', 'maintenance'].map((status) => (
            <Pressable
              key={status}
              onPress={() => setFilter(status)}
              style={[styles.filterChip, filter === status && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                {status === 'all' ? 'All rooms' : labels[status]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.roomGrid}>
          {visibleRooms.map((room) => (
            <Pressable
              key={room.number}
              onPress={() => markReady(room)}
              style={[styles.roomCard, styles[`room_${room.status}`]]}
              accessibilityRole="button"
              accessibilityLabel={`Room ${room.number}, ${labels[room.status]}${room.status === 'cleaning' ? ', mark ready' : ''}`}
            >
              <View style={styles.roomCardTop}>
                <Text style={styles.roomNumber}>{room.number}</Text>
                <View style={[styles.statusDot, styles[`dot_${room.status}`]]} />
              </View>
              <Text style={styles.roomType}>{room.type}</Text>
              <Text style={styles.roomGuest}>{room.guest || (room.status === 'cleaning' ? 'Housekeeping in progress' : labels[room.status])}</Text>
              <View style={styles.roomFooter}>
                <Text style={styles.roomRate}>{room.rate} <Text style={styles.perNight}>/ night</Text></Text>
                <Text style={styles.roomStatus}>{labels[room.status]}</Text>
              </View>
              {room.status === 'cleaning' && <Text style={styles.readyAction}>Tap when ready →</Text>}
            </Pressable>
          ))}
          {visibleRooms.length === 0 && <Text style={styles.empty}>No rooms with that status.</Text>}
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>✦</Text>
          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>The next little welcome</Text>
            <Text style={styles.tipText}>Kavya & Nikhil · Room 102 · Check-in at 2:00 pm</Text>
          </View>
        </View>
        <Text style={styles.footer}>A slower kind of stay. Made with care in Goa.</Text>
      </ScrollView>
      {!!notice && <View style={styles.toast}><Text style={styles.toastText}>{notice}</Text></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f2' },
  page: { paddingHorizontal: 19, paddingBottom: 32 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e8ebe4' },
  brandIcon: { width: 35, height: 35, borderRadius: 18, borderWidth: 1, borderColor: '#d8e0d4', alignItems: 'center', justifyContent: 'center' },
  brandLeaf: { color: '#728b70', fontSize: 19 },
  brandCopy: { marginLeft: 9, flex: 1 },
  brandName: { color: '#263c30', fontSize: 19, fontFamily: 'Georgia' },
  brandHouse: { color: '#81907c' },
  brandCaption: { marginTop: 2, color: '#899286', fontSize: 7, letterSpacing: 1.1 },
  userBadge: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8eee4' },
  userInitials: { color: '#567259', fontSize: 10, fontWeight: '700' },
  welcome: { paddingTop: 29, paddingBottom: 21 },
  eyebrow: { marginBottom: 8, color: '#829080', fontSize: 8, fontWeight: '700', letterSpacing: 1.25 },
  title: { color: '#293f32', fontSize: 30, fontFamily: 'Georgia' },
  subtitle: { marginTop: 6, color: '#869086', fontSize: 11 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, padding: 14, borderWidth: 1, borderColor: '#e7ebe3', backgroundColor: '#fffefa' },
  summaryLabel: { color: '#8a9387', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  summaryValue: { marginTop: 10, color: '#344d3b', fontSize: 27, fontFamily: 'Georgia' },
  summaryTotal: { color: '#9da69a', fontSize: 15 },
  sectionHeading: { marginTop: 28, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#304537', fontSize: 20, fontFamily: 'Georgia' },
  sectionCopy: { marginTop: 4, color: '#90988d', fontSize: 9 },
  roomCount: { color: '#929a8f', fontSize: 8, letterSpacing: 1 },
  filters: { gap: 7, paddingBottom: 13 },
  filterChip: { paddingVertical: 7, paddingHorizontal: 11, borderWidth: 1, borderColor: '#e4e9e1', backgroundColor: '#fffefa' },
  filterChipActive: { borderColor: '#dce7d9', backgroundColor: '#eaf1e7' },
  filterText: { color: '#798579', fontSize: 9 },
  filterTextActive: { color: '#49684e', fontWeight: '700' },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  roomCard: { width: '48.5%', minHeight: 133, padding: 10, borderWidth: 1, borderColor: '#e9ede6', borderLeftWidth: 3, backgroundColor: '#fffefa' },
  room_available: { borderLeftColor: '#729376' },
  room_occupied: { borderLeftColor: '#c5a15e' },
  room_cleaning: { borderLeftColor: '#7394b3' },
  room_maintenance: { borderLeftColor: '#cb8370' },
  roomCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomNumber: { color: '#314b39', fontSize: 19, fontFamily: 'Georgia' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#729477' },
  dot_occupied: { backgroundColor: '#c3a361' },
  dot_cleaning: { backgroundColor: '#7795b1' },
  dot_maintenance: { backgroundColor: '#c9836f' },
  roomType: { marginTop: 4, color: '#748074', fontSize: 9 },
  roomGuest: { marginTop: 7, color: '#647166', fontSize: 8 },
  roomFooter: { marginTop: 'auto', paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  roomRate: { color: '#788477', fontSize: 8 },
  perNight: { color: '#9da49b', fontSize: 7 },
  roomStatus: { color: '#809080', fontSize: 7 },
  readyAction: { marginTop: 7, color: '#597b5e', fontSize: 8, fontWeight: '700' },
  empty: { width: '100%', padding: 24, color: '#7c887e', textAlign: 'center', fontSize: 11 },
  tipCard: { marginTop: 18, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e7ebe3', backgroundColor: '#f0f3eb' },
  tipIcon: { width: 29, height: 29, textAlign: 'center', textAlignVertical: 'center', color: '#768c6f', fontSize: 18 },
  tipCopy: { marginLeft: 9, flex: 1 },
  tipTitle: { color: '#49604d', fontSize: 10, fontWeight: '700' },
  tipText: { marginTop: 4, color: '#7b877c', fontSize: 8 },
  footer: { marginTop: 21, color: '#a0a69e', textAlign: 'center', fontSize: 8 },
  toast: { position: 'absolute', right: 16, bottom: 20, left: 16, padding: 13, backgroundColor: '#2e4d39' },
  toastText: { color: 'white', textAlign: 'center', fontSize: 10 },
});
