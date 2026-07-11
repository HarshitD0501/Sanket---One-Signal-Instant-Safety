const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseLatitude = (value) => {
  const latitude = parseNumber(value);
  if (latitude === null || latitude < -90 || latitude > 90) return null;
  return latitude;
};

const parseLongitude = (value) => {
  const longitude = parseNumber(value);
  if (longitude === null || longitude < -180 || longitude > 180) return null;
  return longitude;
};

const parseCoordinates = ({ lat, lng }) => {
  const latitude = parseLatitude(lat);
  const longitude = parseLongitude(lng);

  if (latitude === null || longitude === null) {
    return {
      isValid: false,
      message: 'Valid latitude and longitude are required.',
    };
  }

  return {
    isValid: true,
    lat: latitude,
    lng: longitude,
  };
};

const parseRadius = (value, { defaultValue = 5000, min = 100, max = 50000 } = {}) => {
  if (value === undefined || value === null || value === '') return defaultValue;

  const radius = parseNumber(value);
  if (radius === null) return null;

  const rounded = Math.round(radius);
  if (rounded < min || rounded > max) return null;
  return rounded;
};

module.exports = {
  parseCoordinates,
  parseRadius,
};
