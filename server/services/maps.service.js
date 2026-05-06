const axios = require('axios');

/**
 * Fetch nearby safe zones (police, hospitals, fire stations) using Google Places API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Search radius in meters (default 5000 = 5km)
 * @returns {Promise<object>} Categorized nearby places
 */
const getNearbyPlaces = async (lat, lng, radius = 5000) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  Google Maps API key not configured. Returning mock data.');
    return getMockSafeZones(lat, lng);
  }

  const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  // Fetch all categories in parallel
  const categories = [
    { type: 'police', label: 'Police Station', icon: '🚔' },
    { type: 'hospital', label: 'Hospital', icon: '🏥' },
    { type: 'fire_station', label: 'Fire Station', icon: '🚒' },
  ];

  const results = await Promise.all(
    categories.map(async (category) => {
      try {
        const response = await axios.get(baseUrl, {
          params: {
            location: `${lat},${lng}`,
            radius,
            type: category.type,
            key: apiKey,
          },
        });

        return {
          category: category.type,
          label: category.label,
          icon: category.icon,
          places: (response.data.results || []).slice(0, 5).map((place) => ({
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
        console.error(`❌ Google Places API error for ${category.type}:`, error.message);
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

/**
 * Reverse geocode coordinates to address using Google Geocoding API
 */
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
    console.error('❌ Reverse geocoding error:', error.message);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

/**
 * Mock safe zones for development without API key
 */
const getMockSafeZones = (lat, lng) => {
  return [
    {
      category: 'police',
      label: 'Police Station',
      icon: '🚔',
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
      ],
    },
    {
      category: 'hospital',
      label: 'Hospital',
      icon: '🏥',
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
      ],
    },
    {
      category: 'fire_station',
      label: 'Fire Station',
      icon: '🚒',
      places: [
        {
          id: 'mock-fire-1',
          name: 'Fire Station',
          address: 'Near your location',
          lat: lat + 0.007,
          lng: lng - 0.004,
          rating: 4.0,
          isOpen: true,
        },
      ],
    },
  ];
};

module.exports = {
  getNearbyPlaces,
  reverseGeocode,
};
