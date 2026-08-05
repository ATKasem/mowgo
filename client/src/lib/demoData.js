// Demo data — lawn care clients, jobs, crew members, and invoices
const today = new Date().toISOString().split('T')[0];

export const demoClients = [
  { id: '1', name: 'Bill Henderson', address: '123 Oak St, Edmond, OK', latitude: 35.6528, longitude: -97.4787, phone: '405-555-0101', email: 'bill@email.com', rate: 50, service_notes: 'Mow front + back, edge driveway, trim hedges. Use mulching blade.', key_code: '4829', alarm_code: '', pet_instructions: '1 friendly golden retriever. Give treat on counter.', tags: ['vip'] },
  { id: '2', name: 'Karen Walsh', address: '456 Elm Ave, OKC, OK', latitude: 35.5219, longitude: -97.4377, phone: '405-555-0102', email: 'karen@email.com', rate: 65, service_notes: 'Large yard — 0.4 acres. Mow, edge, blow. Fertilize every 6 weeks.', key_code: '7712', alarm_code: '1234', pet_instructions: '', tags: [] },
  { id: '3', name: 'Marcus Lee', address: '789 Maple Dr, Edmond, OK', latitude: 35.6535, longitude: -97.4811, phone: '405-555-0103', email: 'marcus@email.com', rate: 40, service_notes: 'Small lawn. Quick mow + edge. Gate on left side of house.', key_code: '5591', alarm_code: '', pet_instructions: 'No pets. Leave gate unlocked.', tags: ['late-payer'] },
  { id: '4', name: 'David & Emma Ruiz', address: '321 Pine Ln, OKC, OK', latitude: 35.4927, longitude: -97.5334, phone: '405-555-0104', email: 'david@email.com', rate: 55, service_notes: 'Biweekly service. Mow, trim, blow. Both front and back.', key_code: '', alarm_code: '5678', pet_instructions: '2 cats — do NOT let outside.', tags: [] },
  { id: '5', name: 'Tom Harrison', address: '654 Birch Ct, Nichols Hills, OK', latitude: 35.5512, longitude: -97.5447, phone: '405-555-0105', email: 'tom@email.com', rate: 80, service_notes: 'Premium lawn — 0.6 acres. Mow with stripes, edge, blow, bag clippings.', key_code: '9023', alarm_code: '', pet_instructions: '', tags: ['do-not-service'] },
];

export const demoLeads = [
  { id: 'demo-lead-1', user_id: 'demo-owner-001', name: 'Sarah Mitchell', phone: '405-555-0130', email: 'sarah@example.com', address: '820 Cedar Ridge, Edmond, OK', source: 'booking_link', notes: 'Asked about weekly mowing and spring cleanup.', status: 'new', client_id: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'demo-lead-2', user_id: 'demo-owner-001', name: 'James Carter', phone: '405-555-0131', email: '', address: '44 NW 18th St, OKC, OK', source: 'referral', notes: 'Referred by Bill Henderson.', status: 'contacted', client_id: null, created_at: new Date(Date.now() - 86400000 * 3).toISOString(), updated_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'demo-lead-3', user_id: 'demo-owner-001', name: 'Olivia Brooks', phone: '', email: 'olivia@example.com', address: '1900 Lakeview Dr, Nichols Hills, OK', source: 'facebook', notes: 'Requested an estimate for a large corner lot.', status: 'quoted', client_id: null, created_at: new Date(Date.now() - 86400000 * 6).toISOString(), updated_at: new Date(Date.now() - 86400000 * 4).toISOString() },
];

// Demo owner profile id — all demo crew point here
const DEMO_OWNER_ID = 'demo-owner-001';

export const demoTeamMembers = [
  { id: 'demo-owner-001', business_name: 'Green Thumb Lawn Care', phone: '405-555-0100', latitude: 35.4676, longitude: -97.5164, avatar_url: null, tier: 'crew', role: 'owner', business_id: null, created_at: '2025-01-01T00:00:00Z' },
  { id: 'demo-crew-001',  business_name: 'Jake Torres',          phone: '405-555-0201', avatar_url: null, tier: 'crew', role: 'crew',  business_id: DEMO_OWNER_ID, created_at: '2025-03-15T00:00:00Z' },
  { id: 'demo-crew-002',  business_name: 'Maria Santos',         phone: '405-555-0202', avatar_url: null, tier: 'crew', role: 'crew',  business_id: DEMO_OWNER_ID, created_at: '2025-04-20T00:00:00Z' },
];

export const demoJobs = [
  { id: '1', client_id: '1', title: 'Mow + Edge',          scheduled_date: today, scheduled_time: '08:00', duration_minutes: 45, status: 'done',         route_order: 1, recurrence: 'weekly',   assigned_to: 'demo-owner-001', clients: demoClients[0] },
  { id: '2', client_id: '2', title: 'Full Service',         scheduled_date: today, scheduled_time: '09:30', duration_minutes: 90, status: 'in_progress',  route_order: 2, recurrence: 'weekly',   assigned_to: 'demo-crew-001',  clients: demoClients[1] },
  { id: '3', client_id: '3', title: 'Quick Mow',            scheduled_date: today, scheduled_time: '11:00', duration_minutes: 30, status: 'scheduled',    route_order: 3, recurrence: 'biweekly', assigned_to: 'demo-crew-002',  clients: demoClients[2] },
  { id: '4', client_id: '4', title: 'Biweekly Service',     scheduled_date: today, scheduled_time: '13:00', duration_minutes: 60, status: 'scheduled',    route_order: 4, recurrence: 'biweekly', assigned_to: null,               clients: demoClients[3] },
];

export const demoInvoices = [
  { id: '1', clients: demoClients[0], amount: 50, status: 'paid',   created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: '2', clients: demoClients[1], amount: 65, status: 'paid',   created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: '3', clients: demoClients[4], amount: 80, status: 'unpaid', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '4', clients: demoClients[0], amount: 50, status: 'unpaid', created_at: new Date().toISOString() },
];
