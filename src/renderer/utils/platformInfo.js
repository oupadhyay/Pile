import { Device } from '@capacitor/device';

let currentPlatform = 'web'; // Default platform
let isMacOs = false; // Default
let isWindowsOs = false; // Default

const fetchPlatformInfo = async () => {
  try {
    const info = await Device.getInfo();
    currentPlatform = info.platform; // e.g., 'android', 'ios', 'web', 'mac', 'windows'
    isMacOs = currentPlatform === 'mac' || currentPlatform === 'ios'; // Treat iOS as having Mac-like UI conventions for keybindings for now
    isWindowsOs = currentPlatform === 'windows';
    console.log('Platform info:', info);
  } catch (err) {
    console.error('Error getting device info:', err);
    // Keep defaults if error occurs
  }
};

// Fetch the info when the module loads.
// This is a top-level await, which might not be ideal in all contexts,
// but for this utility, it's a simple way to try and get the info early.
// A better approach in a larger app might be to initialize this in App's useEffect.
fetchPlatformInfo();

// Synchronous getters that return the latest fetched info
export const getPlatform = () => currentPlatform;
export const isMac = () => isMacOs;
export const isWindows = () => isWindowsOs;

// Async getter if components need to ensure info is fetched
export const getDeviceInfo = async () => {
  await fetchPlatformInfo(); // ensure it's been called if not already
  return { platform: currentPlatform, isMac: isMacOs, isWindows: isWindowsOs };
};
