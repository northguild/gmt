export interface TimezoneInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const TIMEZONES: TimezoneInfo[] = [
  { id: "Pacific/Niue", name: "Pacific/Niue", lat: -19.05, lng: -169.92 },
  { id: "America/New_York", name: "America/New_York", lat: 40.71, lng: -74.01 },
  { id: "UTC", name: "UTC", lat: 0, lng: 0 },
  { id: "Europe/London", name: "Europe/London", lat: 51.5, lng: -0.12 },
  { id: "Asia/Kolkata", name: "Asia/Kolkata", lat: 22.57, lng: 88.36 },
  { id: "Asia/Kathmandu", name: "Asia/Kathmandu", lat: 27.72, lng: 85.32 },
  { id: "Asia/Shanghai", name: "Asia/Shanghai", lat: 31.23, lng: 121.47 },
  {
    id: "Australia/Lord_Howe",
    name: "Australia/Lord_Howe",
    lat: -31.52,
    lng: 159.08,
  },
  { id: "Pacific/Chatham", name: "Pacific/Chatham", lat: -43.95, lng: -176.57 },
  { id: "Pacific/Apia", name: "Pacific/Apia", lat: -13.83, lng: -171.77 },
];
