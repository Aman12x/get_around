export type CountryId =
  | 'uk'
  | 'france'
  | 'italy'
  | 'greece'
  | 'egypt'
  | 'india'
  | 'china'
  | 'japan'
  | 'usa'
  | 'mexico'
  | 'brazil'
  | 'morocco'
  | 'nigeria'
  | 'ethiopia'
  | 'kenya'
  | 'south-africa'
  | 'turkey'
  | 'jordan'
  | 'iran'
  | 'uae'
  | 'norway'
  | 'sweden'
  | 'denmark'
  | 'iceland'
  | 'australia'
  | 'new-zealand';

export interface Country {
  id: CountryId;
  name: string;
  /** ISO 3166-1 numeric code, matches world-atlas feature ids. */
  iso: string;
  flag: string;
  lat: number;
  lon: number;
  nickname: string;
  landmark: string;
  /** Main accent colour (used for globe fill, pins, stamps). */
  color: string;
  /** Diorama sky gradient: top → horizon. */
  sky: [string, string];
  /** Diorama island ground colour. */
  ground: string;
  /** Map-round viewport: [south, north, west, east] in degrees (mainland focus). */
  mapView: [number, number, number, number];
}

export const COUNTRIES: Country[] = [
  {
    id: 'uk', name: 'United Kingdom', iso: '826', flag: '🇬🇧', lat: 51.5, lon: -0.13,
    nickname: 'Isles of Kings & Steam', landmark: 'Big Ben',
    color: '#ef4444', sky: ['#6d83f2', '#ffd1e8'], ground: '#5fbf5a', mapView: [49.8, 61, -8.7, 2.1],
  },
  {
    id: 'france', name: 'France', iso: '250', flag: '🇫🇷', lat: 48.86, lon: 2.35,
    nickname: 'Land of Lights & Revolutions', landmark: 'Eiffel Tower',
    color: '#3b82f6', sky: ['#ff8fb1', '#ffe8a8'], ground: '#8bd16a', mapView: [41.2, 51.3, -5.3, 9.8],
  },
  {
    id: 'italy', name: 'Italy', iso: '380', flag: '🇮🇹', lat: 41.9, lon: 12.5,
    nickname: 'Cradle of Empire & Renaissance', landmark: 'Colosseum',
    color: '#22c55e', sky: ['#ff9a5a', '#ffe0a3'], ground: '#b7cf63', mapView: [36.5, 47.2, 6.5, 18.7],
  },
  {
    id: 'greece', name: 'Greece', iso: '300', flag: '🇬🇷', lat: 37.97, lon: 23.73,
    nickname: 'Birthplace of Democracy', landmark: 'Parthenon',
    color: '#0ea5e9', sky: ['#38bdf8', '#e0f7ff'], ground: '#d9c58b', mapView: [34.7, 41.9, 19.2, 29.8],
  },
  {
    id: 'egypt', name: 'Egypt', iso: '818', flag: '🇪🇬', lat: 29.98, lon: 31.13,
    nickname: 'Kingdom of the Pharaohs', landmark: 'Pyramids of Giza',
    color: '#f59e0b', sky: ['#f97316', '#fde68a'], ground: '#f2c46d', mapView: [21.8, 31.8, 24.6, 37],
  },
  {
    id: 'india', name: 'India', iso: '356', flag: '🇮🇳', lat: 27.17, lon: 78.04,
    nickname: 'Land of a Thousand Kingdoms', landmark: 'Taj Mahal',
    color: '#f97316', sky: ['#c084fc', '#ffd6a5'], ground: '#7cc96b', mapView: [6.5, 35.8, 68, 97.5],
  },
  {
    id: 'china', name: 'China', iso: '156', flag: '🇨🇳', lat: 39.9, lon: 116.4,
    nickname: 'Middle Kingdom of Dynasties', landmark: 'Pagoda & Great Wall',
    color: '#dc2626', sky: ['#fb7185', '#fef3c7'], ground: '#6cbf6a', mapView: [18, 53.7, 73.4, 134.9],
  },
  {
    id: 'japan', name: 'Japan', iso: '392', flag: '🇯🇵', lat: 35.36, lon: 138.73,
    nickname: 'Land of the Rising Sun', landmark: 'Mount Fuji & Torii',
    color: '#ec4899', sky: ['#818cf8', '#ffd1dc'], ground: '#77c77a', mapView: [25.6, 45.8, 126.6, 146.2],
  },
  {
    id: 'usa', name: 'United States', iso: '840', flag: '🇺🇸', lat: 40.69, lon: -74.04,
    nickname: 'Land of the Moonshot', landmark: 'Statue of Liberty',
    color: '#6366f1', sky: ['#4f46e5', '#a5f3fc'], ground: '#6fc36b', mapView: [24.3, 49.5, -125, -66.8],
  },
  {
    id: 'mexico', name: 'Mexico', iso: '484', flag: '🇲🇽', lat: 20.68, lon: -88.57,
    nickname: 'Heart of the Maya & Aztec', landmark: 'El Castillo, Chichén Itzá',
    color: '#10b981', sky: ['#f43f5e', '#fcd34d'], ground: '#9acd5a', mapView: [14.4, 32.8, -118.5, -86.6],
  },
  {
    id: 'brazil', name: 'Brazil', iso: '076', flag: '🇧🇷', lat: -22.95, lon: -43.21,
    nickname: 'Rainforest & Rhythm', landmark: 'Christ the Redeemer',
    color: '#facc15', sky: ['#06b6d4', '#fef9c3'], ground: '#3fb36b', mapView: [-33.9, 5.4, -74.1, -34.7],
  },
  {
    id: 'morocco', name: 'Morocco', iso: '504', flag: '🇲🇦', lat: 31.62, lon: -7.99,
    nickname: 'Gateway of Sands and Souks', landmark: 'Koutoubia Minaret',
    color: '#e11d48', sky: ['#fb923c', '#fde68a'], ground: '#e9b872', mapView: [27.6, 36, -13.4, -0.9],
  },
  {
    id: 'nigeria', name: 'Nigeria', iso: '566', flag: '🇳🇬', lat: 9.08, lon: 7.4,
    nickname: 'Giant of Africa', landmark: 'Zuma Rock',
    color: '#16a34a', sky: ['#22c55e', '#fef08a'], ground: '#7ccf5f', mapView: [4.1, 14, 2.5, 14.8],
  },
  {
    id: 'ethiopia', name: 'Ethiopia', iso: '231', flag: '🇪🇹', lat: 12.03, lon: 39.04,
    nickname: 'Land of Origins', landmark: 'Lalibela & Aksum Stele',
    color: '#ca8a04', sky: ['#f59e0b', '#fef3c7'], ground: '#93c45d', mapView: [3.3, 15, 32.8, 48.1],
  },
  {
    id: 'kenya', name: 'Kenya', iso: '404', flag: '🇰🇪', lat: -1.29, lon: 36.82,
    nickname: 'Cradle of Humankind', landmark: 'Savanna & Mount Kenya',
    color: '#b91c1c', sky: ['#f97316', '#fde68a'], ground: '#c9b458', mapView: [-4.8, 5.6, 33.7, 42],
  },
  {
    id: 'south-africa', name: 'South Africa', iso: '710', flag: '🇿🇦', lat: -33.92, lon: 18.42,
    nickname: 'Rainbow Nation', landmark: 'Table Mountain',
    color: '#0d9488', sky: ['#0ea5e9', '#fbcfe8'], ground: '#79c46a', mapView: [-35, -22, 16.3, 33],
  },
  {
    id: 'turkey', name: 'Turkey', iso: '792', flag: '🇹🇷', lat: 41.01, lon: 28.98,
    nickname: 'Bridge Between Continents', landmark: 'Hagia Sophia',
    color: '#ef4444', sky: ['#60a5fa', '#fecdd3'], ground: '#a3cf6a', mapView: [35.7, 42.2, 25.6, 45],
  },
  {
    id: 'jordan', name: 'Jordan', iso: '400', flag: '🇯🇴', lat: 30.33, lon: 35.44,
    nickname: 'Kingdom of the Rose City', landmark: 'Petra Treasury',
    color: '#be185d', sky: ['#f472b6', '#fed7aa'], ground: '#e7a77a', mapView: [29.1, 33.5, 34.8, 39.4],
  },
  {
    id: 'iran', name: 'Iran', iso: '364', flag: '🇮🇷', lat: 32.65, lon: 51.67,
    nickname: 'Heart of Ancient Persia', landmark: 'Shah Mosque, Isfahan',
    color: '#0891b2', sky: ['#22d3ee', '#fef3c7'], ground: '#d8c08a', mapView: [24.9, 39.9, 43.9, 63.4],
  },
  {
    id: 'uae', name: 'United Arab Emirates', iso: '784', flag: '🇦🇪', lat: 25.2, lon: 55.27,
    nickname: 'Desert Skyline', landmark: 'Burj Khalifa',
    color: '#7c3aed', sky: ['#8b5cf6', '#fed7aa'], ground: '#efc98a', mapView: [22.5, 26.2, 51.4, 56.5],
  },
  {
    id: 'norway', name: 'Norway', iso: '578', flag: '🇳🇴', lat: 60.39, lon: 5.32,
    nickname: 'Land of Fjords', landmark: 'Stave Church',
    color: '#1d4ed8', sky: ['#38bdf8', '#e0f2fe'], ground: '#6fbf7a', mapView: [57.8, 71.3, 4.4, 31.3],
  },
  {
    id: 'sweden', name: 'Sweden', iso: '752', flag: '🇸🇪', lat: 59.33, lon: 18.07,
    nickname: 'Kingdom of Lakes and Forests', landmark: 'Dala Horse & Red Cottages',
    color: '#2563eb', sky: ['#60a5fa', '#fef9c3'], ground: '#79c66d', mapView: [55.2, 69.2, 10.9, 24.3],
  },
  {
    id: 'denmark', name: 'Denmark', iso: '208', flag: '🇩🇰', lat: 55.68, lon: 12.57,
    nickname: 'Home of Hygge', landmark: 'Nyhavn & The Little Mermaid',
    color: '#dc2626', sky: ['#93c5fd', '#fecaca'], ground: '#86cf73', mapView: [54.5, 57.8, 8, 13],
  },
  {
    id: 'iceland', name: 'Iceland', iso: '352', flag: '🇮🇸', lat: 64.15, lon: -21.94,
    nickname: 'Land of Fire and Ice', landmark: 'Hallgrímskirkja & Geysir',
    color: '#0284c7', sky: ['#6366f1', '#a7f3d0'], ground: '#7fb88a', mapView: [63.2, 66.7, -24.7, -13.3],
  },
  {
    id: 'australia', name: 'Australia', iso: '036', flag: '🇦🇺', lat: -33.86, lon: 151.21,
    nickname: 'The Great Southern Land', landmark: 'Sydney Opera House',
    color: '#f97316', sky: ['#0ea5e9', '#fde68a'], ground: '#d9a05b', mapView: [-44, -10.5, 112.5, 154],
  },
  {
    id: 'new-zealand', name: 'New Zealand', iso: '554', flag: '🇳🇿', lat: -36.85, lon: 174.76,
    nickname: 'Land of the Long White Cloud', landmark: 'Sky Tower & Southern Alps',
    color: '#059669', sky: ['#38bdf8', '#d9f99d'], ground: '#5fbf6a', mapView: [-47.4, -34.3, 166.3, 178.7],
  },
];

export const COUNTRY_BY_ID: Record<CountryId, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c]),
) as Record<CountryId, Country>;

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso, c]),
);
