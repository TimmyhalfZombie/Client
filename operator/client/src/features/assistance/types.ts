export type LatLng = { lat: number; lng: number };

export type AssistStatus =
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | (string & {});

export type AssistanceRequest = {
  id: string;
  status?: AssistStatus;

  clientName: string;
  phone?: string | null;

  placeName: string;
  address: string;
  coords?: LatLng | null;

  vehicleType?: string | null;
  plateNumber?: string | null;
  otherInfo?: string | null;

  createdAt?: string;
  updatedAt?: string;

  _raw?: any;
};
