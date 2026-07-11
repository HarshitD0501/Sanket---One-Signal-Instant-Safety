// Temporary switch while database/login issues are being fixed.
// Set this to false to restore the saved login and register pages.
export const AUTH_DETACHED = false;

export const DETACHED_USER = {
  _id: 'detached-admin',
  name: 'Admin',
  email: 'admin@sanket.local',
  phone: '',
  sosActive: false,
  createdAt: new Date(0).toISOString(),
};
