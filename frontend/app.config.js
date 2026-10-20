const app = require('./app.json');

module.exports = {
  ...app,
  expo: {
    ...app.expo,
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
    },
  },
};