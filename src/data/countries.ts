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
  | 'brazil';

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
];

export const COUNTRY_BY_ID: Record<CountryId, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c]),
) as Record<CountryId, Country>;

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso, c]),
);
