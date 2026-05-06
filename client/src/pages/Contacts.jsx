import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi2';

const RELATIONS = ['Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Other'];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', relation: 'Other', whatsappEnabled: true, callEnabled: true });

  const fetchContacts = () => {
    api.get('/contacts').then((r) => { setContacts(r.data.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(fetchContacts, []);

  const resetForm = () => { setForm({ name: '', phone: '', relation: 'Other', whatsappEnabled: true, callEnabled: true }); setEditId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/contacts/${editId}`, form);
        toast.success('Contact updated');
      } else {
        await api.post('/contacts', form);
        toast.success('Contact added');
      }
      fetchContacts();
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleEdit = (c) => {
    setForm({ name: c.name, phone: c.phone, relation: c.relation, whatsappEnabled: c.whatsappEnabled, callEnabled: c.callEnabled });
    setEditId(c._id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this contact?')) return;
    try { await api.delete(`/contacts/${id}`); toast.success('Contact removed'); fetchContacts(); }
    catch { toast.error('Failed to delete'); }
  };

  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  if (loading) return <div className="page container"><div className="loader" /></div>;

  return (
    <div className="page container">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <div className="page-subtitle">Safety Network</div>
          <h1 className="page-title">Emergency Contacts</h1>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} disabled={contacts.length >= 5}>
          <HiOutlinePlus size={18} /> Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="empty-state glass">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No emergency contacts</div>
          <div className="empty-text">Add trusted people who will be notified when you trigger SOS</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><HiOutlinePlus size={18} /> Add First Contact</button>
        </div>
      ) : (
        <div className="contacts-grid">
          {contacts.map((c, i) => (
            <div key={c._id} className="contact-card glass animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
              <div className="contact-info">
                <div className="contact-name">{c.name}</div>
                <div className="contact-phone">{c.phone}</div>
                <span className="contact-relation">{c.relation}</span>
              </div>
              <div className="contact-actions">
                <button className="contact-action-btn" onClick={() => handleEdit(c)} title="Edit"><HiOutlinePencil /></button>
                <button className="contact-action-btn delete" onClick={() => handleDelete(c._id)} title="Delete"><HiOutlineTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        {contacts.length}/5 contacts added
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editId ? 'Edit Contact' : 'Add Emergency Contact'}</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" placeholder="Mom" required value={form.name} onChange={update('name')} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (with country code)</label>
                <input className="form-input" placeholder="+919876543210" required value={form.phone} onChange={update('phone')} />
              </div>
              <div className="form-group">
                <label className="form-label">Relation</label>
                <select className="form-select" value={form.relation} onChange={update('relation')}>
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.whatsappEnabled} onChange={(e) => setForm({ ...form, whatsappEnabled: e.target.checked })} /> WhatsApp Alert
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.callEnabled} onChange={(e) => setForm({ ...form, callEnabled: e.target.checked })} /> Voice Call
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editId ? 'Update' : 'Add Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
