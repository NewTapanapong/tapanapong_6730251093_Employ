import Constants from 'expo-constants';

const configuredUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const cloudApiUrl = 'http://119.59.102.161:3081/api';

export const API_URL = (configuredUrl || cloudApiUrl).replace(/\/$/, '');