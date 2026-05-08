import { useState, useEffect, FormEvent } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineTrash, HiOutlinePencil, HiOutlinePlus } from 'react-icons/hi2';
import type { EmergencyContact } from '../types';

export default function Contacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/contacts');
      setContacts(res.data.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchContacts(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/contacts/${editId}`, { name, phone, relation });
        toast.success('Contact updated');
      } else {
        await api.post('/contacts', { name, phone, relation, whatsappEnabled: true, callEnabled: true });
        toast.success('Contact added');
      }
      resetForm();
      fetchContacts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save contact');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/contacts/${id}`);
      toast.success('Contact removed');
      fetchContacts();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEdit = (c: EmergencyContact) => {
    setEditId(c._id);
    setName(c.name);
    setPhone(c.phone);
    setRelation(c.relation);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setPhone('');
    setRelation('');
  };

  return (
    <div className="contacts-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-subtitle">Emergency</div>
          <h1 className="page-title">Contacts</h1>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <HiOutlinePlus size={16} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" required />
          </div>
          <div className="form-group">
            <label className="form-label">Relation</label>
            <input className="form-input" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Mother, Friend, etc." required />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary btn-sm">{editId ? 'Update' : 'Add Contact'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}

      {contacts.length === 0 && !showForm ? (
        <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No emergency contacts yet. Add at least one to enable SOS.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <HiOutlinePlus size={16} /> Add Your First Contact
          </button>
        </div>
      ) : (
        contacts.map((c) => (
          <div key={c._id} className="contact-card glass">
            <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
            <div className="contact-info">
              <div className="contact-name">{c.name}</div>
              <div className="contact-phone">{c.phone} · {c.relation}</div>
            </div>
            <div className="contact-actions">
              <button className="btn btn-outline btn-sm" onClick={() => handleEdit(c)} style={{ padding: '0.4rem' }}>
                <HiOutlinePencil size={14} />
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => handleDelete(c._id)} style={{ padding: '0.4rem', color: 'var(--accent)' }}>
                <HiOutlineTrash size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
