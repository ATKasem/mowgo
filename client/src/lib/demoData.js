// Demo data — no backend required
const today = new Date().toISOString().split('T')[0];

export const demoClients = [
  { id: '1', name: 'Sarah Johnson', address: '123 Oak St, Edmond, OK', phone: '405-555-0101', email: 'sarah@email.com', rate: 120, cleaning_notes: 'Focus on kitchen + bathrooms. Use natural cleaners.', key_code: '4829', alarm_code: '', pet_instructions: '1 friendly golden retriever. Give treat on counter.' },
  { id: '2', name: 'Mike Peterson', address: '456 Elm Ave, OKC, OK', phone: '405-555-0102', email: 'mike@email.com', rate: 150, cleaning_notes: 'Large house — 3 bed, 2 bath. Vacuum upstairs too.', key_code: '7712', alarm_code: '1234', pet_instructions: '' },
  { id: '3', name: 'Lisa Chen', address: '789 Maple Dr, Edmond, OK', phone: '405-555-0103', email: 'lisa@email.com', rate: 100, cleaning_notes: 'Studio apartment. Quick clean. Change sheets.', key_code: '5591', alarm_code: '', pet_instructions: 'No pets. Leave key under mat.' },
  { id: '4', name: 'David & Emma Ruiz', address: '321 Pine Ln, OKC, OK', phone: '405-555-0104', email: 'david@email.com', rate: 140, cleaning_notes: 'Biweekly deep clean. All 4 bedrooms.', key_code: '', alarm_code: '5678', pet_instructions: '2 cats — do NOT let outside.' },
  { id: '5', name: 'Tom Harrison', address: '654 Birch Ct, Nichols Hills, OK', phone: '405-555-0105', email: 'tom@email.com', rate: 180, cleaning_notes: 'Premium clean. Use their supplies in garage.', key_code: '9023', alarm_code: '', pet_instructions: '' },
];

export const demoJobs = [
  { id: '1', client_id: '1', title: 'Biweekly Clean', scheduled_date: today, scheduled_time: '08:00', duration_minutes: 120, status: 'done', route_order: 1, clients: demoClients[0] },
  { id: '2', client_id: '2', title: 'Deep Clean', scheduled_date: today, scheduled_time: '10:30', duration_minutes: 180, status: 'in_progress', route_order: 2, clients: demoClients[1] },
  { id: '3', client_id: '3', title: 'Studio Clean', scheduled_date: today, scheduled_time: '14:00', duration_minutes: 60, status: 'scheduled', route_order: 3, clients: demoClients[2] },
  { id: '4', client_id: '4', title: 'Biweekly Clean', scheduled_date: today, scheduled_time: '15:30', duration_minutes: 120, status: 'scheduled', route_order: 4, clients: demoClients[3] },
];

export const demoInvoices = [
  { id: '1', clients: demoClients[0], amount: 120, status: 'paid', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: '2', clients: demoClients[1], amount: 150, status: 'paid', created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: '3', clients: demoClients[4], amount: 180, status: 'unpaid', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '4', clients: demoClients[0], amount: 120, status: 'unpaid', created_at: new Date().toISOString() },
];
