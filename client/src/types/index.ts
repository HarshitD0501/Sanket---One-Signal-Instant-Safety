export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profilePic?: string;
  lastKnownLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  sosActive: boolean;
  createdAt: string;
}

export interface EmergencyContact {
  _id: string;
  userId: string;
  name: string;
  phone: string;
  relation: string;
  whatsappEnabled: boolean;
  callEnabled: boolean;
  createdAt: string;
}

export interface SOSEvent {
  _id: string;
  userId: string;
  triggerType: 'tap' | 'shake';
  status: 'active' | 'resolved' | 'false_alarm';
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  trackingId: string;
  notifications: SOSNotification[];
  resolvedAt?: string;
  createdAt: string;
}

export interface SOSNotification {
  contactId: string;
  whatsappSent: boolean;
  whatsappSentAt?: string;
  voiceCallSid?: string;
  voiceCallStatus?: string;
  voiceCalledAt?: string;
}

export interface LocationCoordinate {
  lat: number;
  lng: number;
  timestamp?: string;
}

export interface LocationHistory {
  _id: string;
  sosEventId: string;
  userId: string;
  coordinates: LocationCoordinate[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ActiveSOS {
  sosId: string;
  _id: string;
  trackingId: string;
  status: string;
  location: LocationCoordinate;
  createdAt: string;
}
