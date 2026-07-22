import { useState, useMemo } from 'react';
import { demoClients } from '../lib/demoData';
import { Search, Plus, Pencil, Trash2, MapPin, Phone, Mail, Key, AlarmCheck, PawPrint, StickyNote, ChevronRight, Users } from 'lucide-react';

const emptyForm = { name: '', address: '', phone: '', email: '', rate: 0, cleaning_notes: '', key_code: '', alarm_code: '', pet_instructions: '' };

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const avatarColors = ['bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'];

export default function Clients() {
  const [clients, setClients] = useState(demoClients);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);

  function openNew() { setEditId(null); setForm(emptyForm); setExpandedId(null); setShowForm(true); }
  function openEdit(client) { setEditId(client.id); setForm(client); setExpandedId(null); setShowForm(true); }

  function save(e) {
    e.preventDefault();
    if (editId) setClients(clients.map(c => c.id === editId ? { ...form, id: editId } : c));
    else setClients([...clients, { ...form, id: String(Date.now()) }]);
    setShowForm(false);
  }

  function remove(id) { setClients(clients.filter(c => c.id !== id)); if (expandedId === id) setExpandedId(null); }

  const filtered = useMemo(() => clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.address || '').toLowerCase().includes(search.toLowerCase())), [clients, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Clients</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{clients.length} total</p></div>
        <button onClick={openNew} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />Add Client</button>
      </div>

      <div className="relative mb-4"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search by name or address..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" /></div>

      {showForm && (
        <form onSubmit={save} className="card p-5 mb-4 space-y-3 border-sky-200 dark:border-sky-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{editId ? 'Edit Client' : 'New Client'}</h3>
          <div><label className="label">Name *</label><input placeholder="Jane Smith" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required /></div>
          <div><label className="label">Address</label><input placeholder="123 Main St, OKC, OK" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Phone</label><input placeholder="405-555-0100" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></div><div><label className="label">Email</label><input placeholder="jane@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></div></div>
          <div><label className="label">Rate ($/clean)</label><input type="number" placeholder="120" value={form.rate} onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} className="input" /></div>
          <div><label className="label">Cleaning Notes</label><textarea placeholder="Focus on kitchen..." value={form.cleaning_notes} onChange={e => setForm({ ...form, cleaning_notes: e.target.value })} className="input" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Key Code</label><input placeholder="4829" value={form.key_code} onChange={e => setForm({ ...form, key_code: e.target.value })} className="input" /></div><div><label className="label">Alarm Code</label><input placeholder="1234" value={form.alarm_code} onChange={e => setForm({ ...form, alarm_code: e.target.value })} className="input" /></div></div>
          <div><label className="label">Pet Instructions</label><input placeholder="1 friendly dog..." value={form.pet_instructions} onChange={e => setForm({ ...form, pet_instructions: e.target.value })} className="input" /></div>
          <div className="flex gap-2 pt-1"><button type="submit" className="btn-primary flex-1">{editId ? 'Save Changes' : 'Add Client'}</button><button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button></div>
        </form>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-semibold">{search ? 'No matching clients' : 'No clients yet'}</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{search ? 'Try a different search' : 'Add your first client to get started'}</p>
          </div>
        )}
        {filtered.map((client, i) => {
          const isEditing = editId === client.id;
          const isExpanded = expandedId === client.id;
          return (
            <div key={client.id} className={isEditing ? 'opacity-40 pointer-events-none' : ''}>
              <div className="card p-4 flex items-center gap-3 cursor-pointer hover:border-sky-200 dark:hover:border-sky-800 transition-all" onClick={() => setExpandedId(isExpanded ? null : client.id)}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColors[i % avatarColors.length]}`}>{getInitials(client.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{client.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {client.address && <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{client.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-info">${client.rate}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="card border-t-0 rounded-t-none -mt-1 p-4 pt-3 space-y-2.5" style={{ animation: 'slideDown 0.15s ease-out' }}>
                  {client.phone && <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400"><Phone className="w-3.5 h-3.5 text-gray-400" />{client.phone}</div>}
                  {client.email && <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400"><Mail className="w-3.5 h-3.5 text-gray-400" />{client.email}</div>}
                  {client.cleaning_notes && <div className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400"><StickyNote className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />{client.cleaning_notes}</div>}
                  <div className="flex flex-wrap gap-1.5">
                    {client.key_code && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 inline-flex items-center gap-1 text-[11px]"><Key className="w-3 h-3" />Key: {client.key_code}</span>}
                    {client.alarm_code && <span className="badge bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 text-[11px]"><AlarmCheck className="w-3 h-3" />Alarm: {client.alarm_code}</span>}
                    {client.pet_instructions && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 inline-flex items-center gap-1 text-[11px]"><PawPrint className="w-3 h-3" />{client.pet_instructions}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(client); }} className="btn-secondary text-xs py-1.5 px-3 gap-1"><Pencil className="w-3 h-3" />Edit</button>
                    <button onClick={e => { e.stopPropagation(); remove(client.id); }} className="btn-ghost text-xs py-1.5 px-3 gap-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"><Trash2 className="w-3 h-3" />Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
