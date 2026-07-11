const axios = require('axios');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch nearby police stations and hospitals using Google Places API.
 * Google Nearby Search returns up to 20 results per page and up to 3 pages.
 */
const getNearbyPlaces = async (lat, lng, radius = 10000) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('Google Maps API key not configured. Returning mock data.');
    return getMockSafeZones(lat, lng);
  }

  const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const categories = [
    { type: 'police', label: 'Police Station', icon: 'police' },
    { type: 'hospital', label: 'Hospital', icon: 'hospital' },
  ];

  const results = await Promise.all(
    categories.map(async (category) => {
      try {
        const places = [];
        let pageToken = null;

        for (let page = 0; page < 3; page += 1) {
          if (pageToken) {
            await sleep(1800);
          }

          const response = await axios.get(baseUrl, {
            params: pageToken
              ? { pagetoken: pageToken, key: apiKey }
              : {
                  location: `${lat},${lng}`,
                  radius,
                  type: category.type,
                  key: apiKey,
                },
          });

          places.push(...(response.data.results || []));

          pageToken = response.data.next_page_token;
          if (!pageToken) break;
        }

        return {
          category: category.type,
          label: category.label,
          icon: category.icon,
          places: places.map((place) => ({
            id: place.place_id,
            name: place.name,
            address: place.vicinity,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            rating: place.rating || null,
            isOpen: place.opening_hours?.open_now ?? null,
          })),
        };
      } catch (error) {
        console.error(`Google Places API error for ${category.type}:`, error.message);
        return {
          category: category.type,
          label: category.label,
          icon: category.icon,
          places: [],
        };
      }
    })
  );

  return results;
};

const reverseGeocode = async (lat, lng) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${lat},${lng}`,
          key: apiKey,
        },
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].formatted_address;
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

const getMockSafeZones = (lat, lng) => [
  {
    category: 'police',
    label: 'Police Station',
    icon: 'police',
    places: [
      {
        id: 'mock-police-1',
        name: 'Local Police Station',
        address: 'Near your location',
        lat: lat + 0.005,
        lng: lng + 0.003,
        rating: 4.2,
        isOpen: true,
      },
      {
        id: 'mock-police-2',
        name: 'Police Help Point',
        address: 'Near your location',
        lat: lat - 0.006,
        lng: lng + 0.004,
        rating: 4.1,
        isOpen: true,
      },
    ],
  },
  {
    category: 'hospital',
    label: 'Hospital',
    icon: 'hospital',
    places: [
      {
        id: 'mock-hospital-1',
        name: 'City Hospital',
        address: 'Near your location',
        lat: lat - 0.004,
        lng: lng + 0.006,
        rating: 4.5,
        isOpen: true,
      },
      {
        id: 'mock-hospital-2',
        name: 'Emergency Medical Center',
        address: 'Near your location',
        lat: lat + 0.006,
        lng: lng - 0.005,
        rating: 4.3,
        isOpen: true,
      },
    ],
  },
];

module.exports = {
  getNearbyPlaces,
  reverseGeocode,
};
